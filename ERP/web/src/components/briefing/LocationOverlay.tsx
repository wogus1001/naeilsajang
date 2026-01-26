'use client';

import { Map, MapMarker, Circle } from 'react-kakao-maps-sdk';

interface LocationOverlayProps {
    address: string | null;
    lat?: number;
    lng?: number;
    showDetail?: boolean;
}

export function LocationOverlay({ address, lat, lng, showDetail = false }: LocationOverlayProps) {
    // Default to Seoul Hall if no coords (should be provided by geocoding in backend or DB)
    // For now, if lat/lng missing, we can't show map accurately.
    // Assuming DB has lat/lng in `data`. if not, show placeholder.

    const center = { lat: lat || 37.5665, lng: lng || 126.9780 };
    const isAvailable = !!(lat && lng);

    if (!isAvailable) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-sm">
                지도 정보가 없습니다.
            </div>
        );
    }

    return (

        <Map
            center={center}
            style={{ width: '100%', height: '100%' }}
            level={showDetail ? 3 : 7} // Level 7 for ~1km view
            draggable={showDetail}
            zoomable={showDetail}
        >
            {showDetail ? (
                <MapMarker position={center} />
            ) : (
                <Circle
                    center={center}
                    radius={800} // 800m radius (~1.6km diameter)
                    strokeWeight={1}
                    strokeColor={'#75B8FA'}
                    strokeOpacity={0.5}
                    strokeStyle={'solid'}
                    fillColor={'#CFE7FF'}
                    fillOpacity={0.5}
                />
            )}
        </Map>
    );
}
