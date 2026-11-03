import React from 'react';
import {it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import {ContinuityViews} from '../components/ContinuityViews';
import {buildContinuityWorkspace} from '../domain/continuityWorkspace';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
it('shows exact selected take frame planning beside explicit legacy images without creating a plan',async()=>{
 const f=await seedKeyframeStorage(),model=buildContinuityWorkspace(f.state.collections[0],f.state.scenes,f.state.media),selected=model.rows.find(r=>r.shot.id===f.shotId)!;
 render(<ContinuityViews model={model} rows={model.rows} selected={selected} view="frames" onPick={()=>{}} onPair={()=>{}} renderFrames={()=> <p>Legacy images retained</p>}/>);
 expect(screen.getByRole('heading',{name:'Frames & Prompts'})).toBeInTheDocument();expect(screen.getByText(/3 planned image frames/)).toBeInTheDocument();expect(screen.getByText('Legacy images retained')).toBeInTheDocument();
});
