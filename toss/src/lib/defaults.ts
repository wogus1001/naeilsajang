import { ChecklistItem } from '../types';

export function createDefaultChecklistItems(): ChecklistItem[] {
  return [
    { id: 'open-lights', label: '전등 켜기', type: 'open', order: 1 },
    { id: 'open-hvac', label: '냉난방 가동', type: 'open', order: 2 },
    { id: 'open-pos', label: 'POS/금전등록기 확인', type: 'open', order: 3 },
    { id: 'open-cash', label: '현금 시재 확인', type: 'open', order: 4 },
    { id: 'open-cleaning', label: '매장 청소', type: 'open', order: 5 },
    { id: 'open-sign', label: '간판/외부 조명 켜기', type: 'open', order: 6 },
    { id: 'close-cash', label: '현금 정산', type: 'close', order: 1 },
    { id: 'close-cleaning', label: '마감 청소', type: 'close', order: 2 },
    { id: 'close-hvac', label: '냉난방 끄기', type: 'close', order: 3 },
    { id: 'close-lights', label: '전등 끄기', type: 'close', order: 4 },
    { id: 'close-gas', label: '가스 밸브 잠금', type: 'close', order: 5 },
    { id: 'close-lock', label: '문단속 확인', type: 'close', order: 6 },
  ];
}
