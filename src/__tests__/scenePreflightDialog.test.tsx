import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScenePreflightDialog } from '../components/ScenePreflightDialog';
import type { PreflightFinding } from '../domain/scenePreflight';
afterEach(cleanup);
const finding: PreflightFinding={id:'P001-evidence',ruleId:'P001',severity:'review',title:'Gaze conflict',components:['camera'],evidence:[{component:'camera',text:'Exact preserved rear view.'}],explanation:'Review these directions.',suggestedActions:['Adjust composition.']};
it('shows preserved evidence and routes source/edit and local acknowledgement',()=> { const view=vi.fn(), edit=vi.fn(), change=vi.fn(); render(<ScenePreflightDialog findings={[finding]} onClose={()=>{}} onViewSource={view} onEditComponent={edit} onIntentionalIdsChange={change}/>); expect(screen.getByText('Exact preserved rear view.')).toBeTruthy(); fireEvent.click(screen.getByRole('button',{name:'View source: camera'})); expect(view).toHaveBeenCalledWith('camera'); fireEvent.click(screen.getByRole('button',{name:'Edit component: camera'})); expect(edit).toHaveBeenCalledWith('camera'); fireEvent.click(screen.getByRole('checkbox')); expect(change).toHaveBeenCalledWith(['P001-evidence']); });
it('prevents acknowledging blockers and offers Edit a Copy for saved scenes',()=>{ render(<ScenePreflightDialog findings={[{...finding,severity:'blocking'}]} onClose={()=>{}} onViewSource={()=>{}} onEditComponent={()=>{}} readOnly/>); expect(screen.queryByRole('checkbox')).toBeNull(); expect(screen.getByRole('button',{name:'Edit a Copy: camera'})).toBeTruthy(); });
