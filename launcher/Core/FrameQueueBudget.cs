namespace Krakinai.BridgeLauncher.Core;

/// <summary>Shared outgoing-frame credits, reserved before any queue or allocation.</summary>
public sealed class FrameQueueBudget(int limit = FrameCodec.QueueBytes)
{
    private readonly object sync = new();
    private int used;
    private sealed class Credit(FrameQueueBudget owner, int bytes) : IDisposable
    {
        private int released;
        public void Dispose()
        {
            if (Interlocked.Exchange(ref released, 1) == 0) lock (owner.sync) owner.used -= bytes;
        }
    }
    public IDisposable Reserve(int bytes)
    {
        lock (sync)
        {
            if (bytes <= 0 || bytes > limit || used > limit - bytes) throw new LauncherFault("IPC_QUEUE_LIMIT");
            used += bytes; return new Credit(this, bytes);
        }
    }
}
