using System.Text.Json;

namespace Krakinai.BridgeLauncher.Core;

/// <summary>Admission follows actual host work, independently of a caller's wait.</summary>
public sealed class HostRequestLedger(TimeProvider? clock = null)
{
    private readonly TimeProvider clock = clock ?? TimeProvider.System;
    private readonly object sync = new();
    private readonly Dictionary<(string, string), Pending> pending = new();
    private readonly HashSet<(string, string)> retired = new();
    private readonly Queue<(string, string)> retirementOrder = new();
    private Exception? closed;
    public sealed class Pending
    {
        internal Pending((string, string) key) { Key = key; }
        internal readonly (string, string) Key;
        internal readonly TaskCompletionSource<JsonElement> Source = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal long BeganAt;
        public Task<JsonElement> Completion => Source.Task;
        public bool WritingBegan { get; internal set; }
    }
    public Pending Reserve(JsonElement frame)
    {
        var key = (FrameCodec.Text(frame, "connectionId"), FrameCodec.Text(frame, "requestId"));
        lock (sync)
        {
            if (closed is not null) throw new LauncherFault("DISCONNECTED");
            if (pending.ContainsKey(key) || retired.Contains(key)) throw new LauncherFault("IPC_DUPLICATE_REQUEST");
            if (pending.Count >= 16) throw new LauncherFault("QUEUE_FULL");
            var item = new Pending(key); pending.Add(key, item); return item;
        }
    }
    private bool Contains(Pending item) => pending.TryGetValue(item.Key, out var current) && ReferenceEquals(item, current);
    public bool TryBeginWrite(Pending item)
    {
        lock (sync)
        {
            if (!Contains(item) || item.WritingBegan) return false;
            item.BeganAt = clock.GetTimestamp(); item.WritingBegan = true; return true;
        }
    }
    public void CancelCaller(Pending item, CancellationToken token)
    {
        lock (sync)
        {
            if (!Contains(item)) return;
            item.Source.TrySetCanceled(token);
            if (!item.WritingBegan) Retire(item);
        }
    }
    public void RejectUnsent(Pending item, Exception error)
    {
        lock (sync)
        {
            if (!Contains(item)) return;
            if (item.WritingBegan) throw new InvalidOperationException("Cannot retire dispatched work before its terminal response");
            Retire(item); item.Source.TrySetException(error);
        }
    }
    public void Complete(JsonElement frame)
    {
        var key = (FrameCodec.Text(frame, "connectionId"), FrameCodec.Text(frame, "requestId"));
        lock (sync)
        {
            if (!pending.TryGetValue(key, out var item) || !item.WritingBegan) throw new LauncherFault("IPC_UNEXPECTED_RESULT");
            Retire(item); item.Source.TrySetResult(frame);
        }
    }
    private void Retire(Pending item)
    {
        pending.Remove(item.Key); retired.Add(item.Key); retirementOrder.Enqueue(item.Key);
        while (retirementOrder.Count > 128) retired.Remove(retirementOrder.Dequeue());
    }
    public bool HasExpired()
    {
        lock (sync) return pending.Values.Any(item => item.WritingBegan && clock.GetElapsedTime(item.BeganAt) >= TimeSpan.FromSeconds(20));
    }
    public void Close(Exception error)
    {
        lock (sync)
        {
            closed ??= error;
            foreach (var item in pending.Values) item.Source.TrySetException(error);
            pending.Clear();
        }
    }
}
