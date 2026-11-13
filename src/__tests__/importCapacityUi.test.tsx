import React from 'react';
import {it,expect} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {ImportCapacity} from '../components/ImportCapacity';
it('shows owner storage headroom, prospective totals and independent backup reservation',()=>{
 render(<ImportCapacity capacity={{status:'checked',current:{storedBytes:1048576,expandedBytes:2097152,receipts:2,candidates:0},limits:{storedBytes:8388608,expandedBytes:33554432,receipts:1000,candidates:250},prospective:{storedBytes:1572864,expandedBytes:4194304,receipts:3,candidates:0},receiptBytes:524288,backupMetadataBytes:3000000,backupMetadataLimit:104857600,findings:[]}}/>);
 expect(screen.getByRole('heading',{name:'Storage check'})).toBeVisible();expect(screen.getByText(/Fits current preview/)).toBeVisible();expect(screen.getByText(/7.00 MiB remaining/)).toBeVisible();expect(screen.getByText(/100.00 MiB/)).toBeVisible();cleanup();
});
it('does not invent prospective capacity for an incomplete or old preview',()=>{
 render(<ImportCapacity/>);expect(screen.getByText(/Revalidate to calculate/)).toBeVisible();expect(screen.queryByText(/0.00 MiB/)).toBeNull();cleanup();
 render(<ImportCapacity capacity={{status:'not_calculable',current:{storedBytes:42,expandedBytes:0,receipts:0,candidates:0},limits:{storedBytes:8388608,expandedBytes:33554432,receipts:1000,candidates:250},backupMetadataLimit:104857600,findings:[]}}/>);expect(screen.getByText(/Not yet calculable/)).toBeVisible();expect(screen.queryByText(/Fits current preview/)).toBeNull();cleanup();
});
it('does not round a small nonempty history down to zero',()=>{
 render(<ImportCapacity capacity={{status:'not_calculable',current:{storedBytes:42,expandedBytes:0,receipts:1,candidates:0},limits:{storedBytes:8388608,expandedBytes:33554432,receipts:1000,candidates:250},backupMetadataLimit:104857600,findings:[]}}/>);expect(screen.getByText(/42 bytes/)).toBeVisible();cleanup();
});
