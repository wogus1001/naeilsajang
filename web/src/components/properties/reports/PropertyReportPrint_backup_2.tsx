import React from 'react';
import { Map, MapMarker, StaticMap, DrawingManager } from 'react-kakao-maps-sdk';
import { MousePointer2, Circle as CircleIcon, Slash, Square, Pentagon, Ruler, Trash2, Settings, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

interface PropertyReportPrintProps {
    data: any;
    format: string;
}

const PropertyReportPrint: React.FC<PropertyReportPrintProps> = ({ data, format }) => {
    const [drawingMode, setDrawingMode] = React.useState<any>(null);
    const [map, setMap] = React.useState<kakao.maps.Map | null>(null);
    const [isToolbarOpen, setIsToolbarOpen] = React.useState(true);
    const drawingManagerRef = React.useRef<any>(null);

    // Distance Measurement State
    const [isMeasuring, setIsMeasuring] = React.useState(false);
    const clickLineRef = React.useRef<kakao.maps.Polyline | null>(null);
    const moveLineRef = React.useRef<kakao.maps.Polyline | null>(null);
    const distanceOverlayRef = React.useRef<kakao.maps.CustomOverlay | null>(null);
    const dotsRef = React.useRef<{ circle: kakao.maps.CustomOverlay; distance?: kakao.maps.CustomOverlay }[]>([]);
    const distancesRef = React.useRef<{ polyline: kakao.maps.Polyline; dots: { circle: kakao.maps.CustomOverlay; distance?: kakao.maps.CustomOverlay }[]; overlay: kakao.maps.CustomOverlay }[]>([]);

    // Circle Radius Measurement State
    const [isCircleMeasuring, setIsCircleMeasuring] = React.useState(false);
    const centerPositionRef = React.useRef<kakao.maps.LatLng | null>(null);
    const drawingCircleRef = React.useRef<kakao.maps.Circle | null>(null);
    const drawingCircleLineRef = React.useRef<kakao.maps.Polyline | null>(null);
    const drawingCircleOverlayRef = React.useRef<kakao.maps.CustomOverlay | null>(null);
    const circlesRef = React.useRef<{ circle: kakao.maps.Circle; polyline: kakao.maps.Polyline; overlay: kakao.maps.CustomOverlay }[]>([]);

    // Area Calculation State   
    const [isAreaMeasuring, setIsAreaMeasuring] = React.useState(false);
    const drawingPolygonRef = React.useRef<kakao.maps.Polygon | null>(null);
    const polygonRef = React.useRef<kakao.maps.Polygon | null>(null);
    const areaOverlayRef = React.useRef<kakao.maps.CustomOverlay | null>(null);
    const areasRef = React.useRef<{ polygon: kakao.maps.Polygon; overlay: kakao.maps.CustomOverlay }[]>([]);

    // -- Map Print Stability Logic (Format 3 & Legacy) --
    React.useEffect(() => {
        const handleBeforePrint = () => {
            document.body.classList.add('printing');
            if (map) {
                // 1. Force layout update for print styles
                // 2. Relayout map
                // 3. Restore center/level
                const center = map.getCenter();
                const level = map.getLevel();

                // Double RAF to ensure layout is settled before relayout
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        map.relayout();
                        map.setCenter(center);
                        map.setLevel(level);
                    });
                });
            }
        };

        const handleAfterPrint = () => {
            document.body.classList.remove('printing');
            if (map) {
                // Restore for screen
                map.relayout();
            }
        };

        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);
        return () => {
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, [map]);

    // Helper: Distance Overlay HTML
    const getTimeHTML = (distance: number) => {
        const walkkTime = (distance / 67) | 0;
        let walkHour = '', walkMin = '';
        if (walkkTime > 60) {
            walkHour = `<span style="font-weight:bold;color:#ee4444">${Math.floor(walkkTime / 60)}</span>시간 `;
        }
        walkMin = `<span style="font-weight:bold;color:#ee4444">${walkkTime % 60}</span>분`;

        const bicycleTime = (distance / 227) | 0;
        let bicycleHour = '', bicycleMin = '';
        if (bicycleTime > 60) {
            bicycleHour = `<span style="font-weight:bold;color:#ee4444">${Math.floor(bicycleTime / 60)}</span>시간 `;
        }
        bicycleMin = `<span style="font-weight:bold;color:#ee4444">${bicycleTime % 60}</span>분`;

        return `
            <div style="padding:10px;background:white;border:1px solid #ccc;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.1);font-size:12px;min-width:140px;position:relative">
                <button class="delete-btn print-hide" style="position:absolute;top:5px;right:5px;background:none;border:none;color:#999;cursor:pointer;font-weight:bold;padding:0 5px;line-height:1" title="삭제">×</button>
                <ul style="list-style:none;padding:0;margin:0">
                    <li style="margin-bottom:4px;border-bottom:1px solid #eee;padding-bottom:4px">
                        <span style="font-weight:600;margin-right:10px">총거리</span><span style="font-weight:bold;color:#ee4444">${distance}</span>m
                    </li>
                    <li style="margin-bottom:4px"><span style="font-weight:600;margin-right:10px">도보</span>${walkHour}${walkMin}</li>
                    <li><span style="font-weight:600;margin-right:10px">자전거</span>${bicycleHour}${bicycleMin}</li>
                </ul>
            </div>
        `;
    };

    // Helper: Circle Radius Overlay HTML
    const getCircleTimeHTML = (radius: number) => {
        const walkkTime = (radius / 67) | 0;
        let walkHour = '', walkMin = '';
        if (walkkTime > 60) {
            walkHour = `<span style="font-weight:bold;color:#ee4444">${Math.floor(walkkTime / 60)}</span>시간 `;
        }
        walkMin = `<span style="font-weight:bold;color:#ee4444">${walkkTime % 60}</span>분`;

        const bicycleTime = (radius / 227) | 0;
        let bicycleHour = '', bicycleMin = '';
        if (bicycleTime > 60) {
            bicycleHour = `<span style="font-weight:bold;color:#ee4444">${Math.floor(bicycleTime / 60)}</span>시간 `;
        }
        bicycleMin = `<span style="font-weight:bold;color:#ee4444">${bicycleTime % 60}</span>분`;

        return `
            <div style="padding:10px;background:white;border:1px solid #ccc;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.1);font-size:12px;min-width:140px;position:relative">
                <button class="delete-btn print-hide" style="position:absolute;top:5px;right:5px;background:none;border:none;color:#999;cursor:pointer;font-weight:bold;padding:0 5px;line-height:1" title="삭제">×</button>
                <ul style="list-style:none;padding:0;margin:0">
                    <li style="margin-bottom:4px;border-bottom:1px solid #eee;padding-bottom:4px">
                        <span style="font-weight:600;margin-right:10px">반경</span><span style="font-weight:bold;color:#00a0e9">${radius}</span>m
                    </li>
                    <li style="margin-bottom:4px"><span style="font-weight:600;margin-right:10px">도보</span>${walkHour}${walkMin}</li>
                    <li><span style="font-weight:600;margin-right:10px">자전거</span>${bicycleHour}${bicycleMin}</li>
                </ul>
            </div>
        `;
    };

    const deleteCircleDot = () => {
        dotsRef.current.forEach(dot => {
            dot.circle.setMap(null);
            if (dot.distance) dot.distance.setMap(null);
        });
        dotsRef.current = [];
    };

    const deleteDistance = () => {
        if (distanceOverlayRef.current) {
            distanceOverlayRef.current.setMap(null);
            distanceOverlayRef.current = null;
        }
        distancesRef.current.forEach(item => {
            item.polyline.setMap(null);
            item.dots.forEach(dot => {
                dot.circle.setMap(null);
                if (dot.distance) dot.distance.setMap(null);
            });
            item.overlay.setMap(null);
        });
        distancesRef.current = [];
    };

    const deleteClickLine = () => {
        if (clickLineRef.current) {
            clickLineRef.current.setMap(null);
            clickLineRef.current = null;
        }
    };

    const deleteCircles = () => {
        circlesRef.current.forEach(item => {
            item.circle.setMap(null);
            item.polyline.setMap(null);
            item.overlay.setMap(null);
        });
        circlesRef.current = [];
    };

    const deleteAreas = () => {
        areasRef.current.forEach(item => {
            item.polygon.setMap(null);
            item.overlay.setMap(null);
        });
        areasRef.current = [];
    };

    const resetMeasurement = () => {
        deleteClickLine();
        if (moveLineRef.current) moveLineRef.current.setMap(null);
        moveLineRef.current = null;
        deleteCircleDot();
        deleteDistance();
        setIsMeasuring(false);

        // Reset Circle Radius
        if (drawingCircleRef.current) drawingCircleRef.current.setMap(null);
        if (drawingCircleLineRef.current) drawingCircleLineRef.current.setMap(null);
        if (drawingCircleOverlayRef.current) drawingCircleOverlayRef.current.setMap(null);
        drawingCircleRef.current = null;
        drawingCircleLineRef.current = null;
        drawingCircleOverlayRef.current = null;
        centerPositionRef.current = null;
        setIsCircleMeasuring(false);

        // Reset Area Calculation
        if (drawingPolygonRef.current) drawingPolygonRef.current.setMap(null);
        if (polygonRef.current) polygonRef.current.setMap(null);
        if (areaOverlayRef.current) areaOverlayRef.current.setMap(null);
        drawingPolygonRef.current = null;
        polygonRef.current = null;
        areaOverlayRef.current = null;
        setIsAreaMeasuring(false);
    };

    const handleClearAll = () => {
        resetMeasurement();
        deleteCircles();
        deleteAreas();
        // Also clear drawing manager if possible
        if (drawingManagerRef.current) {
            // Note: DrawingManager doesn't have a direct 'clear all' in some wrappers, 
            // but we'll try to cancel current and the user can re-draw.
            drawingManagerRef.current.cancel();
        }
    };

    const handleMapClick = (mouseEvent: kakao.maps.event.MouseEvent) => {
        if (drawingMode === 'distance') {
            const clickPosition = mouseEvent.latLng;

            if (!isMeasuring) {
                setIsMeasuring(true);
                deleteClickLine();
                deleteDistance();
                deleteCircleDot();

                clickLineRef.current = new kakao.maps.Polyline({
                    map: map!,
                    path: [clickPosition],
                    strokeWeight: 3,
                    strokeColor: '#db4040',
                    strokeOpacity: 1,
                    strokeStyle: 'solid'
                });

                moveLineRef.current = new kakao.maps.Polyline({
                    path: [],
                    strokeWeight: 3,
                    strokeColor: '#db4040',
                    strokeOpacity: 0.5,
                    strokeStyle: 'solid'
                });

                displayCircleDot(clickPosition as any, 0);
            } else {
                const path = clickLineRef.current!.getPath() as any[];
                path.push(clickPosition);
                clickLineRef.current!.setPath(path);

                const distance = Math.round(clickLineRef.current!.getLength());
                displayCircleDot(clickPosition as any, distance);
            }
        } else if (drawingMode === 'circle_radius') {
            const clickPosition = mouseEvent.latLng;

            if (!isCircleMeasuring) {
                setIsCircleMeasuring(true);
                centerPositionRef.current = clickPosition;

                drawingCircleLineRef.current = new kakao.maps.Polyline({
                    path: [clickPosition],
                    strokeWeight: 3,
                    strokeColor: '#00a0e9',
                    strokeOpacity: 1,
                    strokeStyle: 'solid'
                });

                drawingCircleRef.current = new kakao.maps.Circle({
                    center: clickPosition,
                    radius: 0,
                    strokeWeight: 1,
                    strokeColor: '#00a0e9',
                    strokeOpacity: 0.1,
                    strokeStyle: 'solid',
                    fillColor: '#00a0e9',
                    fillOpacity: 0.2
                });

                drawingCircleOverlayRef.current = new kakao.maps.CustomOverlay({
                    position: clickPosition,
                    xAnchor: 0,
                    yAnchor: 0,
                    zIndex: 1
                });
            }
        } else if (drawingMode === 'area') {
            const clickPosition = mouseEvent.latLng;

            if (!isAreaMeasuring) {
                setIsAreaMeasuring(true);
                deleteAreas();

                drawingPolygonRef.current = new kakao.maps.Polygon({
                    map: map!,
                    path: [clickPosition],
                    strokeWeight: 3,
                    strokeColor: '#00a0e9',
                    strokeOpacity: 1,
                    strokeStyle: 'solid',
                    fillColor: '#00a0e9',
                    fillOpacity: 0.2
                });

                polygonRef.current = new kakao.maps.Polygon({
                    path: [clickPosition],
                    strokeWeight: 3,
                    strokeColor: '#00a0e9',
                    strokeOpacity: 1,
                    strokeStyle: 'solid',
                    fillColor: '#00a0e9',
                    fillOpacity: 0.2
                });
            } else {
                const drawingPath = drawingPolygonRef.current!.getPath() as any[];
                drawingPath.push(clickPosition);
                drawingPolygonRef.current!.setPath(drawingPath);

                const path = polygonRef.current!.getPath() as any[];
                path.push(clickPosition);
                polygonRef.current!.setPath(path);
            }
        }
    };

    const handleMouseMove = (mouseEvent: kakao.maps.event.MouseEvent) => {
        if (drawingMode === 'distance' && isMeasuring && clickLineRef.current) {
            const mousePosition = mouseEvent.latLng;
            const path = clickLineRef.current.getPath() as any[];
            const movepath = [path[path.length - 1], mousePosition];

            moveLineRef.current!.setPath(movepath);
            moveLineRef.current!.setMap(map!);

            const distance = Math.round(clickLineRef.current.getLength() + moveLineRef.current!.getLength());
            const content = `<div style="padding:5px 10px;background:white;border:1px solid #db4040;border-radius:20px;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.1)">총거리 <span style="font-weight:bold;color:#db4040">${distance}</span>m</div>`;

            showDistance(content, mousePosition);
        } else if (drawingMode === 'circle_radius' && isCircleMeasuring && centerPositionRef.current) {
            const mousePosition = mouseEvent.latLng;
            const linePath = [centerPositionRef.current, mousePosition];

            drawingCircleLineRef.current!.setPath(linePath);
            const length = drawingCircleLineRef.current!.getLength();

            if (length > 0) {
                drawingCircleRef.current!.setOptions({
                    center: centerPositionRef.current,
                    radius: length
                });

                const radius = Math.round(drawingCircleRef.current!.getRadius());
                const content = `<div style="padding:5px 10px;background:white;border:1px solid #00a0e9;border-radius:20px;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.1)">반경 <span style="font-weight:bold;color:#00a0e9">${radius}</span>m</div>`;

                drawingCircleOverlayRef.current!.setPosition(mousePosition);
                drawingCircleOverlayRef.current!.setContent(content);

                drawingCircleRef.current!.setMap(map!);
                drawingCircleLineRef.current!.setMap(map!);
                drawingCircleOverlayRef.current!.setMap(map!);
            } else {
                drawingCircleRef.current!.setMap(null);
                drawingCircleLineRef.current!.setMap(null);
                drawingCircleOverlayRef.current!.setMap(null);
            }
        } else if (drawingMode === 'area' && isAreaMeasuring && drawingPolygonRef.current) {
            const mousePosition = mouseEvent.latLng;
            const path = drawingPolygonRef.current.getPath() as any[];

            if (path.length > 1) {
                path.pop();
            }
            path.push(mousePosition);
            drawingPolygonRef.current.setPath(path);
        }
    };

    const handleRightClick = () => {
        if (drawingMode === 'distance' && isMeasuring) {
            if (moveLineRef.current) {
                moveLineRef.current.setMap(null);
                moveLineRef.current = null;
            }

            const path = clickLineRef.current!.getPath() as any[];
            if (path.length > 1) {
                if (dotsRef.current[dotsRef.current.length - 1].distance) {
                    dotsRef.current[dotsRef.current.length - 1].distance!.setMap(null);
                }

                const distance = Math.round(clickLineRef.current!.getLength());
                const contentStr = getTimeHTML(distance);
                const contentNode = document.createElement('div');
                contentNode.innerHTML = contentStr;

                const finalPolyline = clickLineRef.current!;
                const finalDots = [...dotsRef.current];
                const finalOverlay = new kakao.maps.CustomOverlay({
                    map: map!,
                    content: contentNode,
                    position: path[path.length - 1],
                    xAnchor: 0,
                    yAnchor: 0,
                    zIndex: 3
                });

                const deleteBtn = contentNode.querySelector('.delete-btn');
                if (deleteBtn) {
                    (deleteBtn as HTMLElement).onclick = () => {
                        finalPolyline.setMap(null);
                        finalDots.forEach(dot => {
                            dot.circle.setMap(null);
                            if (dot.distance) dot.distance.setMap(null);
                        });
                        finalOverlay.setMap(null);
                    };
                }

                distancesRef.current.push({
                    polyline: finalPolyline,
                    dots: finalDots,
                    overlay: finalOverlay
                });

                // Clear active refs but keep objects on map (handled by deleteBtn)
                clickLineRef.current = null;
                dotsRef.current = [];
            } else {
                resetMeasurement();
            }
            setIsMeasuring(false);
        } else if (drawingMode === 'circle_radius' && isCircleMeasuring && centerPositionRef.current) {
            // Finalize circle radius
            const path = drawingCircleLineRef.current!.getPath() as any[];
            const rClickPosition = path[path.length - 1];

            const polyline = new kakao.maps.Polyline({
                map: map!,
                path: [centerPositionRef.current, rClickPosition],
                strokeWeight: 3,
                strokeColor: '#00a0e9',
                strokeOpacity: 1,
                strokeStyle: 'solid'
            });

            const circle = new kakao.maps.Circle({
                map: map!,
                center: centerPositionRef.current,
                radius: polyline.getLength(),
                strokeWeight: 1,
                strokeColor: '#00a0e9',
                strokeOpacity: 0.1,
                strokeStyle: 'solid',
                fillColor: '#00a0e9',
                fillOpacity: 0.2
            });

            const radius = Math.round(circle.getRadius());
            const contentStr = getCircleTimeHTML(radius);
            const contentNode = document.createElement('div');
            contentNode.innerHTML = contentStr;

            const radiusOverlay = new kakao.maps.CustomOverlay({
                map: map!,
                content: contentNode,
                position: rClickPosition,
                xAnchor: 0,
                yAnchor: 0,
                zIndex: 1
            });

            const deleteBtn = contentNode.querySelector('.delete-btn');
            if (deleteBtn) {
                (deleteBtn as HTMLElement).onclick = () => {
                    polyline.setMap(null);
                    circle.setMap(null);
                    radiusOverlay.setMap(null);
                };
            }

            circlesRef.current.push({
                polyline,
                circle,
                overlay: radiusOverlay
            });

            // Cleanup drawing objects
            if (drawingCircleRef.current) drawingCircleRef.current.setMap(null);
            if (drawingCircleLineRef.current) drawingCircleLineRef.current.setMap(null);
            if (drawingCircleOverlayRef.current) drawingCircleOverlayRef.current.setMap(null);

            drawingCircleRef.current = null;
            drawingCircleLineRef.current = null;
            drawingCircleOverlayRef.current = null;
            centerPositionRef.current = null;
            setIsCircleMeasuring(false);
        } else if (drawingMode === 'area' && isAreaMeasuring && polygonRef.current) {
            if (drawingPolygonRef.current) {
                drawingPolygonRef.current.setMap(null);
                drawingPolygonRef.current = null;
            }

            const path = polygonRef.current.getPath() as any[];
            if (path.length > 2) {
                polygonRef.current.setMap(map!);

                const area = Math.round(polygonRef.current.getArea());
                const contentStr = `
                    <div style="padding:10px;background:white;border:1px solid #00a0e9;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.1);font-size:12px;position:relative">
                        <button class="delete-btn print-hide" style="position:absolute;top:5px;right:5px;background:none;border:none;color:#999;cursor:pointer;font-weight:bold;padding:0 5px;line-height:1" title="삭제">×</button>
                        <span style="font-weight:600;margin-right:10px">총면적</span><span style="font-weight:bold;color:#00a0e9">${area}</span> m<sup>2</sup>
                    </div>
                `;

                const contentNode = document.createElement('div');
                contentNode.innerHTML = contentStr;

                const poly = polygonRef.current;
                const overlay = new kakao.maps.CustomOverlay({
                    map: map!,
                    content: contentNode,
                    xAnchor: 0,
                    yAnchor: 0,
                    position: path[path.length - 1]
                });

                const deleteBtn = contentNode.querySelector('.delete-btn');
                if (deleteBtn) {
                    (deleteBtn as HTMLElement).onclick = () => {
                        poly.setMap(null);
                        overlay.setMap(null);
                    };
                }

                areasRef.current.push({
                    polygon: poly,
                    overlay: overlay
                });
            }

            polygonRef.current = null;
            areaOverlayRef.current = null;
            setIsAreaMeasuring(false);
        }
    };

    const showDistance = (content: string, position: kakao.maps.LatLng) => {
        if (distanceOverlayRef.current) {
            distanceOverlayRef.current.setPosition(position);
            distanceOverlayRef.current.setContent(content);
        } else {
            distanceOverlayRef.current = new kakao.maps.CustomOverlay({
                map: map!,
                content: content,
                position: position,
                xAnchor: 0,
                yAnchor: 0,
                zIndex: 3
            });
        }
    };

    const displayCircleDot = (position: kakao.maps.LatLng, distance: number) => {
        const circleOverlay = new kakao.maps.CustomOverlay({
            content: '<span style="display:block;width:8px;height:8px;background:#db4040;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,0.3)"></span>',
            position: position,
            zIndex: 1
        });
        circleOverlay.setMap(map!);

        let distOverlay;
        if (distance > 0) {
            distOverlay = new kakao.maps.CustomOverlay({
                content: `<div style="padding:2px 8px;background:white;border:1px solid #ccc;border-radius:4px;font-size:11px;margin-bottom:15px;box-shadow:0 1px 2px rgba(0,0,0,0.1)">거리 <span style="font-weight:bold">${distance}</span>m</div>`,
                position: position,
                yAnchor: 1,
                zIndex: 2
            });
            distOverlay.setMap(map!);
        }

        dotsRef.current.push({ circle: circleOverlay, distance: distOverlay });
    };

    // Clean up drawing on mode change
    React.useEffect(() => {
        // Measurement tools (distance, circle_radius, area) use manual control
        if (drawingMode === 'distance' || drawingMode === 'circle_radius' || drawingMode === 'area') {
            resetMeasurement();
            if (drawingManagerRef.current) {
                drawingManagerRef.current.cancel();
            }
        } else {
            // Standard drawing tools use the drawingMode prop, but we still reset measurements
            resetMeasurement();
            // If drawingMode is null (select mode), we still want to cancel any active drawing operation
            if (drawingMode === null && drawingManagerRef.current) {
                drawingManagerRef.current.cancel();
            }
        }
    }, [drawingMode]);

    // Basic formatting helpers
    const formatCurrency = (value: number | string) => {
        if (!value) return '0';
        return Number(value).toLocaleString();
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('ko-KR');
    };

    const thStyle = { backgroundColor: '#f8f9fa', fontWeight: 600, color: '#495057', textAlign: 'left' as const };
    const tdStyle = { whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' };

    // Style helper for fixed boxes with truncation
    const getBoxStyle = (height: string, lineClamp: number) => ({
        fontSize: '14px',
        backgroundColor: '#f8f9fa',
        padding: '10px',
        borderRadius: '4px',
        border: '1px solid #e9ecef',
        height: height,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: lineClamp,
        WebkitBoxOrient: 'vertical' as const,
        wordBreak: 'break-all' as const
    });

    // Style for print only
    // Style for print only
    // Style for print only
    // Style for print only
    // Style for print only
    const printStyles = `
        :root {
            --page-w: 210mm;
            --page-h: 297mm;
        }

        /* 1. Global Print Reset & Isolation */
        @media print {
            @page { 
                size: A4 portrait; 
                margin: 0; 
            }
            
            html, body {
                width: 100%;
                height: 100%;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            /* Hide everything by default */
            body * {
                visibility: hidden !important;
                height: 0; /* Collapse space */
                overflow: hidden; 
            }

            /* Show ONLY the print root */
            #print-root, #print-root * {
                visibility: visible !important;
                height: auto;
                overflow: visible;
            }

            /* Reset print root position */
            #print-root {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: transparent !important;
            }
            
            .no-print, .print-hide { display: none !important; }
        }

        /* 2. Common A4 Sheet Logic (User Request A, C) */
        .print-sheet {
            width: 210mm;
            min-height: 297mm;
            background: white;
            /* Safe area padding (User Request C: 8~10mm) */
            padding: 10mm; 
            box-sizing: border-box;
            
            /* Center on screen */
            margin: 0 auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            position: relative;
            display: flex;
            flex-direction: column;
        }

        @media print {
            .print-sheet {
                box-shadow: none;
                margin: 0 !important;
                border: none;
                /* Enforce 1 page for Format 3, others allow flow if needed */
                height: auto; 
                overflow: auto; 
                page-break-after: avoid; 
                break-inside: avoid;
            }
        }

        /* 3. Common Preview Canvas Style (User Request B) */
        .preview-canvas {
            width: auto !important;
            padding: 20px !important;
            background: #eee !important;
            display: flex;
            justify-content: center;
            align-items: flex-start; /* Start from top */
            min-height: 100vh;
        }

        @media print {
             .preview-canvas {
                 width: 100% !important;
                 height: 100% !important;
                 padding: 0 !important;
                 background: white !important;
                 display: block; /* Reset flex for print flow */
             }
        }

        /* 4. Format-Specific Layouts */
        /* Format 3 Grid - Calculated to fit A4 */
        .format3-grid {
             display: grid;
             /* 100% refers to content box (210mm - 20mm padding = 190mm) */
             /* We want gap: 6mm. Column = (100% - 6mm) / 2 */
             grid-template-columns: calc((100% - 6mm) / 2) calc((100% - 6mm) / 2);
             gap: 6mm;
             align-items: start;
        }

        /* Map Container (Fixed mm height for stability) */
        .map-container-print {
             width: 100%;
             /* Fixed height in px mostly safe, but user suggested mm */
             /* 380px is approx 100mm. Let's stick to safe px or mm */
             height: 100mm; 
             border: 1px solid #dee2e6;
             border-radius: 4px;
             overflow: hidden;
             position: relative;
             box-sizing: border-box;
             /* Print Safe Background */
             background-color: #f8f9fa;
             -webkit-print-color-adjust: exact;
             print-color-adjust: exact;
             
             /* Avoid breaking inside */
             break-inside: avoid;
        }

        .report-table.format2 th { width: 90px !important; }
    `;

    const renderFormat1 = () => (
        <>
            {/* Header */}
            <div style={{ borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <div>
                    <h1 style={{ fontSize: '33px', fontWeight: 'bold', margin: '0 0 10px 0' }}>매물 상세 리포트</h1>
                    <div style={{ fontSize: '15px', color: '#666', marginBottom: '4px' }}>발행일: {new Date().toLocaleDateString('ko-KR')}</div>
                    <div style={{ fontSize: '15px', color: '#333' }}>담당자: <span style={{ fontWeight: 'bold' }}>{data.managerName}</span> {data.managerPhone && `(${data.managerPhone})`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '25px', fontWeight: 'bold', color: '#1c7ed6' }}>{data.name || '제목 없음'}</div>
                    <div style={{ fontSize: '17px', fontWeight: 'bold' }}>{data.address || ''}</div>
                </div>
            </div>

            {/* 1. Overview & Scale */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px', marginBottom: '0px' }}>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #333', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>물건 개요</h2>
                    <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle}>업종</th><td style={tdStyle}>{[data.industryCategory, data.industrySector, data.industryDetail].filter(Boolean).join(' > ')}</td></tr>
                            <tr><th style={thStyle}>주소</th><td style={tdStyle}>{data.address} {data.detailAddress}</td></tr>
                            <tr><th style={thStyle}>특징</th><td style={tdStyle}>{data.featureMemo}</td></tr>
                            <tr><th style={thStyle}>위치/상권</th><td style={tdStyle}>{data.locationMemo}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #495057', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>규모</h2>
                    <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle}>층수</th><td style={tdStyle}>{data.currentFloor}층 / {data.totalFloor}층</td></tr>
                            <tr><th style={thStyle}>실면적</th><td style={tdStyle}>{data.area ? `${Number(data.area).toLocaleString()} m² (${(Number(data.area) / 3.3).toFixed(1)}평)` : '-'}</td></tr>
                            <tr><th style={thStyle}>주차</th><td style={tdStyle}>{data.parking}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Attached Full Width Overview Memo */}
            <div style={{
                marginBottom: '30px',
                backgroundColor: '#f9f9f9',
                border: '1px solid #eee',
                borderTop: 'none',
                padding: '10px 15px',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'start'
            }}>
                <span style={{ fontWeight: 'bold', marginRight: '10px', whiteSpace: 'nowrap' }}>메모:</span>
                <span>{data.overviewMemo || '-'}</span>
            </div>



            {/* 2. Price & Franchise (3 Columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #fab005', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>금액 정보</h2>
                    <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle}>보증금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.deposit)} 만원</td></tr>
                            <tr><th style={thStyle}>권리금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.premium)} 만원</td></tr>
                            <tr><th style={{ ...thStyle, backgroundColor: '#fff9db' }}>합계</th><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#f03e3e', backgroundColor: '#fff9db' }}>{formatCurrency((data.deposit || 0) + (data.premium || 0))} 만원</td></tr>
                            <tr><th style={thStyle}>임대료</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.monthlyRent)} 만원</td></tr>
                            <tr><th style={thStyle}>관리비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.maintenance)} 만원</td></tr>
                            <tr><th style={thStyle}>부가세</th><td style={tdStyle}>{data.vat || '-'}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #fd7e14', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>프랜차이즈 비용</h2>
                    <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle}>본사보증금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.hqDeposit)} 만원</td></tr>
                            <tr><th style={thStyle}>가맹비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.franchiseFee)} 만원</td></tr>
                            <tr><th style={thStyle}>교육비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.educationFee)} 만원</td></tr>
                            <tr><th style={thStyle}>리뉴얼</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.renewal)} 만원</td></tr>
                            <tr><th style={thStyle}>로열티</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.royalty)} 만원</td></tr>
                            <tr>
                                <th style={{ ...thStyle, backgroundColor: '#fff4e6' }}>합계금</th>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', backgroundColor: '#fff4e6', color: '#e8590c' }}>
                                    {formatCurrency((data.hqDeposit || 0) + (data.franchiseFee || 0) + (data.educationFee || 0) + (data.renewal || 0) + (data.royalty || 0))} 만원
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #fd7e14', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>가맹 메모</h2>
                    <div style={{ ...getBoxStyle('218px', 11), backgroundColor: '#fff4e6', borderColor: '#ffe8cc' }}>
                        {data.franchiseMemo || '-'}
                    </div>
                </div>
            </div>

            {/* 3. Operations & Revenue */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #82c91e', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>영업 현황</h2>
                    <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr>
                                <th style={thStyle}>개업일</th><td style={tdStyle}>{formatDate(data.openingDate)}</td>
                                <th style={thStyle}>추천업종</th><td style={tdStyle}>{data.recommendedBusiness || '-'}</td>
                            </tr>
                            <tr><th style={thStyle}>시설/인테리어</th><td colSpan={3} style={tdStyle}>{data.facilityInterior || '-'}</td></tr>
                            <tr><th style={thStyle}>주요고객층</th><td colSpan={3} style={tdStyle}>{data.mainCustomer || '-'}</td></tr>
                            <tr><th style={thStyle}>피크타임</th><td colSpan={3} style={tdStyle}>{data.peakTime || '-'}</td></tr>
                            <tr><th style={thStyle}>테이블/룸</th><td colSpan={3} style={tdStyle}>{data.tableCount || '-'}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #12b886', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>매출 및 경비 분석</h2>
                    <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr>
                                <th style={thStyle}>월 총매출</th><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#1c7ed6' }}>{formatCurrency(data.monthlyRevenue)} 만원</td>
                                <th style={thStyle}>인건비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.laborCost)} 만원</td>
                            </tr>
                            <tr>
                                <th style={thStyle}>재료비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.materialCost)}</td>
                                <th style={{ ...thStyle, whiteSpace: 'nowrap' }}>임대/관리비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.rentMaintenance)} 만원</td>
                            </tr>
                            <tr>
                                <th style={thStyle}>제세공과금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.taxUtilities)} 만원</td>
                                <th style={thStyle}>유지보수비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.maintenanceDepreciation)} 만원</td>
                            </tr>
                            <tr>
                                <th style={thStyle}>홍보/기타</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.promoMisc)} 만원</td>
                                <th style={{ ...thStyle, backgroundColor: '#e6fcf5', whiteSpace: 'nowrap' }}>월 예상수익</th>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0ca678', backgroundColor: '#e6fcf5' }}>
                                    {formatCurrency(data.monthlyProfit)} 만원
                                    <span style={{ fontSize: '12px', color: '#495057', marginLeft: '6px' }}>
                                        ({data.yieldPercent ? Number(data.yieldPercent).toFixed(1) : '0'}%)
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Operations & Revenue Memos (Extracted Boxes) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #82c91e', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>영업 메모</h2>
                    <div style={{ ...getBoxStyle('100px', 5), backgroundColor: '#f4fce3', borderColor: '#d8f5a2' }}>
                        {data.operationMemo || '-'}
                    </div>
                </div>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #12b886', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>매출/경비 메모</h2>
                    <div style={{ ...getBoxStyle('100px', 5), backgroundColor: '#e6fcf5', borderColor: '#c3fae8' }}>
                        {data.revenueMemo || '-'}
                    </div>
                </div>
            </div>

            {/* 4. Lease Rights */}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '19px', borderLeft: '4px solid #228be6', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>임대차 권리 분석</h2>
                <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                    <tbody>
                        <tr>
                            <th style={{ ...thStyle, width: '120px' }}>임대기간</th><td style={tdStyle}>{data.leasePeriod || '-'}</td>
                            <th style={{ ...thStyle, width: '120px' }}>임대료변동</th><td style={tdStyle}>{data.rentFluctuation || '-'}</td>
                        </tr>
                        <tr>
                            <th style={thStyle}>공부서류하자</th><td style={tdStyle}>{data.docDefects || '-'}</td>
                            <th style={thStyle}>양수도통보</th><td style={tdStyle}>{data.transferNotice || '-'}</td>
                        </tr>
                        <tr>
                            <th style={thStyle}>화해조서/공증</th><td style={tdStyle}>{data.settlementDefects || '-'}</td>
                            <th style={thStyle}>동업권리관계</th><td style={tdStyle}>{data.partnershipRights || '-'}</td>
                        </tr>
                        <tr>
                            <th style={thStyle}>임대인 정보</th><td colSpan={3} style={tdStyle}>{data.lessorInfo || '-'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Lease Memo (Extracted Box) */}
            <div style={{ marginBottom: '60px' }}>
                <h2 style={{ fontSize: '19px', borderLeft: '4px solid #228be6', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>임대차 메모</h2>
                <div style={{ ...getBoxStyle('100px', 5), backgroundColor: '#e7f5ff', borderColor: '#d0ebff' }}>
                    {data.leaseMemo || '-'}
                </div>
            </div>



            {/* Memo/Description */}
            {
                (data.memo || data.details) && (
                    <div style={{ marginBottom: '30px' }}>
                        <h2 style={{ fontSize: '19px', borderLeft: '4px solid #868e96', paddingLeft: '10px', marginBottom: '15px' }}>상세 내용</h2>
                        <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '14px' }}>
                            {data.memo}
                            {data.memo && data.details && '\n\n'}
                            {data.details}
                        </div>
                    </div>
                )
            }

        </>
    );

    const renderFormat2 = () => (
        <>
            {/* Header */}
            <div style={{ borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <div>
                    <h1 style={{ fontSize: '33px', fontWeight: 'bold', margin: '0 0 10px 0' }}>매물 상세 리포트</h1>
                    <div style={{ fontSize: '15px', color: '#666', marginBottom: '4px' }}>발행일: {new Date().toLocaleDateString('ko-KR')}</div>
                    <div style={{ fontSize: '15px', color: '#333' }}>담당자: <span style={{ fontWeight: 'bold' }}>{data.managerName}</span> {data.managerPhone && `(${data.managerPhone})`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '25px', fontWeight: 'bold', color: '#1c7ed6' }}>{data.name || '제목 없음'}</div>
                    <div style={{ fontSize: '17px', fontWeight: 'bold' }}>{data.address || ''}</div>
                </div>
            </div>

            {/* Print Only Styles for Table (Specific to Format 2/3 to handle long headers) */}
            <style>{`
                .report-table.format2 th {
                    width: 110px !important;
                }
            `}</style>

            {/* 1. Overview & Status (2 Columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #333', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>물건 개요</h2>
                    <table className="report-table format2" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle}>업종</th><td style={tdStyle}>{data.industryDetail}</td></tr>
                            <tr><th style={thStyle}>특징</th><td style={tdStyle}>{data.featureMemo}</td></tr>
                            <tr><th style={thStyle}>주소</th><td style={tdStyle}>{data.address} {data.detailAddress}</td></tr>
                            <tr><th style={thStyle}>위치/상권</th><td style={tdStyle}>{data.locationMemo}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #495057', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>물건 현황</h2>
                    <table className="report-table format2" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr>
                                <th style={thStyle}>층수</th>
                                <td style={tdStyle}>{data.currentFloor}층 / {data.totalFloor}층</td>
                                <th style={thStyle}>실면적</th>
                                <td style={tdStyle}>{data.area ? `${Number(data.area).toLocaleString()} m² (${(Number(data.area) / 3.3).toFixed(1)}평)` : '-'}</td>
                            </tr>
                            <tr>
                                <th style={thStyle}>주차</th>
                                <td style={tdStyle}>{data.parking}</td>
                                <th style={thStyle}>개업일</th>
                                <td style={tdStyle}>{formatDate(data.openingDate)}</td>
                            </tr>
                            <tr><th style={thStyle} title="시설/인테리어">시설/인테리</th><td colSpan={3} style={tdStyle}>{data.facilityInterior}</td></tr>
                            <tr><th style={thStyle} title="주요고객층">주요고객층</th><td colSpan={3} style={tdStyle}>{data.mainCustomer}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Store Characteristics (Full Width) */}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '19px', borderLeft: '4px solid #333', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>매장특성</h2>
                <div style={{ ...getBoxStyle('180px', 9), backgroundColor: '#f8f9fa' }}>{data.overviewMemo || '-'}</div>
            </div>

            {/* 2. Price (Full Width Table) */}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '19px', borderLeft: '4px solid #fab005', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>금액 정보</h2>
                <table className="report-table format2" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: '12%' }} /><col style={{ width: '21%' }} />
                        <col style={{ width: '12%' }} /><col style={{ width: '21%' }} />
                        <col style={{ width: '12%' }} /><col style={{ width: '22%' }} />
                    </colgroup>
                    <tbody>
                        <tr>
                            <th style={thStyle}>보증금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.deposit)} 만원</td>
                            <th style={thStyle}>권리금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.premium)} 만원</td>
                            <th style={{ ...thStyle, backgroundColor: '#fff9db' }}>합계</th><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#f03e3e', backgroundColor: '#fff9db' }}>{formatCurrency((data.deposit || 0) + (data.premium || 0))} 만원</td>
                        </tr>
                        <tr>
                            <th style={thStyle}>임대료</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.monthlyRent)} 만원</td>
                            <th style={thStyle}>관리비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.maintenance)} 만원</td>
                            <th style={thStyle}>부가세</th><td style={tdStyle}>{data.vat || '-'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* 3. Operations & Lease (2 Columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #82c91e', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>영업/임대 현황</h2>
                    <table className="report-table format2" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle} title="골든피크타임">피크타임</th><td style={tdStyle}>{data.peakTime || '-'}</td></tr>
                            <tr><th style={thStyle}>테이블/룸</th><td style={tdStyle}>{data.tableCount || '-'}</td></tr>
                            <tr><th style={thStyle}>추천업종</th><td style={tdStyle}>{data.recommendedBusiness || '-'}</td></tr>
                            <tr><th style={thStyle}>임대기간</th><td style={tdStyle}>{data.leasePeriod || '-'}</td></tr>
                            <tr><th style={thStyle}>임대료변동</th><td style={tdStyle}>{data.rentFluctuation || '-'}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <h2 style={{ fontSize: '19px', height: '24px', marginBottom: '15px' }}> </h2>
                    <table className="report-table format2" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle}>공부서류하자</th><td style={tdStyle}>{data.docDefects || '-'}</td></tr>
                            <tr><th style={thStyle}>양수도통보</th><td style={tdStyle}>{data.transferNotice || '-'}</td></tr>
                            <tr><th style={thStyle} title="화해조서/공증">화해조서</th><td style={tdStyle}>{data.settlementDefects || '-'}</td></tr>
                            <tr><th style={thStyle}>임대인정보</th><td style={tdStyle}>{data.lessorInfo || '-'}</td></tr>
                            <tr><th style={thStyle}>동업권리관계</th><td style={tdStyle}>{data.partnershipRights || '-'}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Memos (2 Sections Remaining) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '18px', borderLeft: '4px solid #82c91e', paddingLeft: '10px', marginBottom: '10px', color: '#333' }}>영업현황 메모</h2>
                    <div style={{ ...getBoxStyle('180px', 9), backgroundColor: '#f4fce3', borderColor: '#d8f5a2' }}>{data.operationMemo || '-'}</div>
                </div>
                <div>
                    <h2 style={{ fontSize: '18px', borderLeft: '4px solid #228be6', paddingLeft: '10px', marginBottom: '10px', color: '#333' }}>임대차권리 메모</h2>
                    <div style={{ ...getBoxStyle('180px', 9), backgroundColor: '#e7f5ff', borderColor: '#d0ebff' }}>{data.leaseMemo || '-'}</div>
                </div>
            </div>
        </>
    );

    const renderFormat3 = () => (
        <>
            {/* Header */}
            <div style={{ borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 5px 0' }}>매물 상세 리포트</h1>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '2px' }}>발행일: {new Date().toLocaleDateString('ko-KR')}</div>
                    <div style={{ fontSize: '13px', color: '#333' }}>담당자: <span style={{ fontWeight: 'bold' }}>{data.managerName}</span> {data.managerPhone && `(${data.managerPhone})`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c7ed6' }}>{data.name || '제목 없음'}</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{data.address || ''}</div>
                </div>
            </div>

            {/* Print Only Styles for Table (Specific to Format 2/3 to handle long headers) */}
            <style>{`
                .report-table.format2 th {
                    width: 110px !important;
                }
            `}</style>

            {/* 1. Overview & Status (2 Columns) */}
            <div className="format3-grid" style={{ marginBottom: '15px' }}>
                <div>
                    <h2 style={{ fontSize: '16px', borderLeft: '4px solid #333', paddingLeft: '8px', marginBottom: '10px', color: '#333' }}>물건 개요</h2>
                    <table className="report-table format2" style={{ width: '100%', fontSize: '13px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle}>업종</th><td style={tdStyle}>{data.industryDetail}</td></tr>
                            <tr><th style={thStyle}>특징</th><td style={tdStyle}>{data.featureMemo}</td></tr>
                            <tr><th style={thStyle}>주소</th><td style={tdStyle}>{data.address} {data.detailAddress}</td></tr>
                            <tr><th style={thStyle}>위치/상권</th><td style={tdStyle}>{data.locationMemo}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <h2 style={{ fontSize: '16px', borderLeft: '4px solid #495057', paddingLeft: '8px', marginBottom: '10px', color: '#333' }}>물건 현황</h2>
                    <table className="report-table format2" style={{ width: '100%', fontSize: '13px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr>
                                <th style={thStyle}>층수</th>
                                <td style={tdStyle}>{data.currentFloor}층 / {data.totalFloor}층</td>
                                <th style={thStyle}>실면적</th>
                                <td style={tdStyle}>{data.area ? `${Number(data.area).toLocaleString()} m² (${(Number(data.area) / 3.3).toFixed(1)}평)` : '-'}</td>
                            </tr>
                            <tr>
                                <th style={thStyle}>주차</th>
                                <td style={tdStyle}>{data.parking}</td>
                                <th style={thStyle}>개업일</th>
                                <td style={tdStyle}>{formatDate(data.openingDate)}</td>
                            </tr>
                            <tr><th style={thStyle} title="시설/인테리어">시설/인테리</th><td colSpan={3} style={tdStyle}>{data.facilityInterior}</td></tr>
                            <tr><th style={thStyle} title="주요고객층">주요고객층</th><td colSpan={3} style={tdStyle}>{data.mainCustomer}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Store Characteristics (Full Width) */}
            <div style={{ marginBottom: '15px' }}>
                <h2 style={{ fontSize: '16px', borderLeft: '4px solid #333', paddingLeft: '8px', marginBottom: '10px', color: '#333' }}>매장특성</h2>
                <div style={{ ...getBoxStyle('80px', 4), backgroundColor: '#f8f9fa', fontSize: '13px' }}>{data.overviewMemo || '-'}</div>
            </div>

            {/* 2. Price (Full Width Table) */}
            <div style={{ marginBottom: '15px' }}>
                <h2 style={{ fontSize: '16px', borderLeft: '4px solid #fab005', paddingLeft: '8px', marginBottom: '10px', color: '#333' }}>금액 정보</h2>
                <table className="report-table format2" style={{ width: '100%', fontSize: '13px', tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: '12%' }} /><col style={{ width: '21%' }} />
                        <col style={{ width: '12%' }} /><col style={{ width: '21%' }} />
                        <col style={{ width: '12%' }} /><col style={{ width: '22%' }} />
                    </colgroup>
                    <tbody>
                        <tr>
                            <th style={thStyle}>보증금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.deposit)} 만원</td>
                            <th style={thStyle}>권리금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.premium)} 만원</td>
                            <th style={{ ...thStyle, backgroundColor: '#fff9db' }}>합계</th><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#f03e3e', backgroundColor: '#fff9db' }}>{formatCurrency((data.deposit || 0) + (data.premium || 0))} 만원</td>
                        </tr>
                        <tr>
                            <th style={thStyle}>임대료</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.monthlyRent)} 만원</td>
                            <th style={thStyle}>관리비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.maintenance)} 만원</td>
                            <th style={thStyle}>부가세</th><td style={tdStyle}>{data.vat || '-'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* 3. Operations & Lease (2 Columns) */}
            <div className="format3-grid" style={{ marginBottom: '15px' }}>
                <div>
                    <h2 style={{ fontSize: '16px', borderLeft: '4px solid #82c91e', paddingLeft: '8px', marginBottom: '10px', color: '#333' }}>영업/임대 현황</h2>
                    <table className="report-table format2" style={{ width: '100%', fontSize: '13px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle} title="골든피크타임">피크타임</th><td style={tdStyle}>{data.peakTime || '-'}</td></tr>
                            <tr><th style={thStyle}>테이블/룸</th><td style={tdStyle}>{data.tableCount || '-'}</td></tr>
                            <tr><th style={thStyle}>추천업종</th><td style={tdStyle}>{data.recommendedBusiness || '-'}</td></tr>
                            <tr><th style={thStyle}>임대기간</th><td style={tdStyle}>{data.leasePeriod || '-'}</td></tr>
                            <tr><th style={thStyle}>임대료변동</th><td style={tdStyle}>{data.rentFluctuation || '-'}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <h2 style={{ fontSize: '16px', height: '24px', marginBottom: '10px' }}> </h2>
                    <table className="report-table format2" style={{ width: '100%', fontSize: '13px', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr><th style={thStyle}>공부서류하자</th><td style={tdStyle}>{data.docDefects || '-'}</td></tr>
                            <tr><th style={thStyle}>양수도통보</th><td style={tdStyle}>{data.transferNotice || '-'}</td></tr>
                            <tr><th style={thStyle} title="화해조서/공증">화해조서</th><td style={tdStyle}>{data.settlementDefects || '-'}</td></tr>
                            <tr><th style={thStyle}>임대인정보</th><td style={tdStyle}>{data.lessorInfo || '-'}</td></tr>
                            <tr><th style={thStyle}>동업권리관계</th><td style={tdStyle}>{data.partnershipRights || '-'}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Memos + Map Combined */}
            <div className="format3-grid" style={{ height: 'calc(100% - 650px)', minHeight: '380px' }}>
                {/* Left Column: Memos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                        <h2 style={{ fontSize: '16px', borderLeft: '4px solid #82c91e', paddingLeft: '8px', marginBottom: '8px', color: '#333' }}>영업현황 메모</h2>
                        <div style={{ ...getBoxStyle('150px', 7), backgroundColor: '#f4fce3', borderColor: '#d8f5a2', fontSize: '13px' }}>{data.operationMemo || '-'}</div>
                    </div>
                    <div>
                        <h2 style={{ fontSize: '16px', borderLeft: '4px solid #228be6', paddingLeft: '8px', marginBottom: '8px', color: '#333' }}>임대차권리 메모</h2>
                        <div style={{ ...getBoxStyle('150px', 7), backgroundColor: '#e7f5ff', borderColor: '#d0ebff', fontSize: '13px' }}>{data.leaseMemo || '-'}</div>
                    </div>
                </div>

                {/* Right Column: Map */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: '16px', borderLeft: '4px solid #e64980', paddingLeft: '8px', marginBottom: '8px', color: '#333' }}>위치 정보</h2>
                    <div className="map-container-print">
                        {(data.coordinates && data.coordinates.lat && data.coordinates.lng) ? (
                            <Map
                                center={{ lat: parseFloat(data.coordinates.lat), lng: parseFloat(data.coordinates.lng) }}
                                style={{ width: '100%', height: '100%' }}
                                level={4}
                                onCreate={setMap}
                                onClick={(_map, mouseEvent) => handleMapClick(mouseEvent)}
                                onMouseMove={(_map, mouseEvent) => handleMouseMove(mouseEvent)}
                                onRightClick={() => handleRightClick()}
                            >
                                <MapMarker
                                    position={{ lat: parseFloat(data.coordinates.lat), lng: parseFloat(data.coordinates.lng) }}
                                />
                                <div className="print-hide" style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    zIndex: 10,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '5px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    padding: '5px 4px',
                                    borderRadius: '20px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    border: '1px solid #dee2e6'
                                }}>
                                    {/* Toggle Button */}
                                    <button
                                        onClick={() => setIsToolbarOpen(!isToolbarOpen)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '6px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            backgroundColor: isToolbarOpen ? '#f1f3f5' : 'transparent',
                                            color: '#495057',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                        title={isToolbarOpen ? '도구 접기' : '지도 도구 열기'}
                                    >
                                        {isToolbarOpen ? <ChevronRight size={14} style={{ transform: 'rotate(-90deg)' }} /> : <Settings size={14} />}
                                    </button>

                                    {isToolbarOpen && (
                                        <>
                                            <div style={{ width: '80%', height: '1px', backgroundColor: '#dee2e6', margin: '2px 0' }} />
                                            {[
                                                { mode: null, icon: <MousePointer2 size={14} />, label: '선택' },
                                                { mode: 'distance', icon: <Ruler size={14} />, label: '거리' },
                                                { mode: 'circle_radius', icon: <CircleIcon size={14} />, label: '반경' },
                                                { mode: 'area', icon: <Pentagon size={14} />, label: '면적' },
                                            ].map((tool) => (
                                                <button
                                                    key={tool.label}
                                                    onClick={() => setDrawingMode(tool.mode)}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column', // Icon above text for vertical bar? No, keep icon only or simple row. Let's do simple icon only if very compact, or Row if space. User asked for vertical.
                                                        // Actually, vertical toolbar usually means stack of buttons.
                                                        // Let's keep it clean: Icon only? Or Icon + Text?
                                                        // If I use Icon + Text in a vertical bar, it gets wide.
                                                        // Let's try Icon only for ultra compactness? No, text helps clarity.
                                                        // Let's stick to consistent Row layout item inside the column container.
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px',
                                                        padding: '6px',
                                                        width: '100%',
                                                        borderRadius: '8px',
                                                        border: '1px solid',
                                                        borderColor: drawingMode === tool.mode ? '#228be6' : 'transparent',
                                                        backgroundColor: drawingMode === tool.mode ? '#e7f5ff' : 'transparent',
                                                        color: drawingMode === tool.mode ? '#1c7ed6' : '#495057',
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                    }}
                                                    title={tool.label}
                                                >
                                                    {tool.icon}
                                                    <span style={{ fontSize: '10px' }}>{tool.label}</span>
                                                </button>
                                            ))}
                                            <div style={{ width: '80%', height: '1px', backgroundColor: '#dee2e6', margin: '2px 0' }} />
                                            <button
                                                onClick={handleClearAll}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px',
                                                    padding: '6px',
                                                    width: '100%',
                                                    borderRadius: '8px',
                                                    border: '1px solid transparent',
                                                    backgroundColor: 'transparent',
                                                    color: '#fa5252',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                                title="전체 지우기"
                                            >
                                                <Trash2 size={14} />
                                                <span style={{ fontSize: '10px' }}>지우기</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                                <DrawingManager
                                    ref={drawingManagerRef}
                                    drawingMode={['circle', 'polyline', 'rectangle', 'polygon'].includes(drawingMode) ? drawingMode : null}
                                    markerOptions={{
                                        draggable: true,
                                        removable: true,
                                    }}
                                    ellipseOptions={{
                                        draggable: true,
                                        removable: true,
                                        editable: true,
                                    }}
                                    arrowOptions={{
                                        draggable: true,
                                        removable: true,
                                        editable: true,
                                    }}
                                    circleOptions={{
                                        draggable: true,
                                        removable: true,
                                        editable: true,
                                        strokeWeight: 5,
                                        strokeColor: '#75B8FA',
                                        strokeOpacity: 1,
                                        strokeStyle: 'dashed',
                                        fillColor: '#CFE7FF',
                                        fillOpacity: 0.7,
                                    }}
                                    polylineOptions={{
                                        draggable: true,
                                        removable: true,
                                        editable: true,
                                        strokeWeight: 5,
                                        strokeColor: '#FFAE00',
                                        strokeOpacity: 0.7,
                                        strokeStyle: 'solid',
                                    }}
                                    rectangleOptions={{
                                        draggable: true,
                                        removable: true,
                                        editable: true,
                                        strokeWeight: 4,
                                        strokeColor: '#FF3DE5',
                                        strokeOpacity: 1,
                                        strokeStyle: 'shortdashdot',
                                        fillColor: '#FF8AEF',
                                        fillOpacity: 0.8,
                                    }}
                                    polygonOptions={{
                                        draggable: true,
                                        removable: true,
                                        editable: true,
                                        strokeWeight: 3,
                                        strokeColor: '#39DE2A',
                                        strokeOpacity: 0.8,
                                        strokeStyle: 'longdash',
                                        fillColor: '#A2FF99',
                                        fillOpacity: 0.7,
                                    }}
                                // Make sure custom overrides are respected
                                />
                            </Map>
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', color: '#adb5bd' }}>
                                지도 좌표 정보가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );



    const renderFormat4 = () => (
        <>
            {/* Header */}
            <div style={{ borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <div>
                    <h1 style={{ fontSize: '33px', fontWeight: 'bold', margin: '0 0 10px 0' }}>매물 상세 리포트</h1>
                    <div style={{ fontSize: '15px', color: '#666', marginBottom: '4px' }}>발행일: {new Date().toLocaleDateString('ko-KR')}</div>
                    <div style={{ fontSize: '15px', color: '#333' }}>담당자: <span style={{ fontWeight: 'bold' }}>{data.managerName}</span> {data.managerPhone && `(${data.managerPhone})`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '25px', fontWeight: 'bold', color: '#1c7ed6' }}>{data.name || '제목 없음'}</div>
                    <div style={{ fontSize: '17px', fontWeight: 'bold' }}>{data.address || ''}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '125mm 55mm', gap: '10mm', marginBottom: '30px' }}>
                {/* Left Column: Tables */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                    {/* 1. Overview & Scale Combined */}
                    <div>
                        <h2 style={{ fontSize: '19px', borderLeft: '4px solid #333', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>물건 개요 및 규모</h2>
                        <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                            <tbody>
                                <tr>
                                    <th style={thStyle}>업종</th><td colSpan={3} style={tdStyle}>{[data.industryCategory, data.industrySector, data.industryDetail].filter(Boolean).join(' > ')}</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>주소</th><td colSpan={3} style={tdStyle}>{data.address} {data.detailAddress}</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>층수</th><td style={tdStyle}>{data.currentFloor}층 / {data.totalFloor}층</td>
                                    <th style={thStyle}>실면적</th><td style={tdStyle}>{data.area ? `${Number(data.area).toLocaleString()} m² (${(Number(data.area) / 3.3).toFixed(1)}평)` : '-'}</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>주차</th><td style={tdStyle}>{data.parking}</td>
                                    <th style={thStyle}>개업일</th><td style={tdStyle}>{formatDate(data.openingDate)}</td>
                                </tr>
                                <tr><th style={thStyle}>특징</th><td colSpan={3} style={tdStyle}>{data.featureMemo}</td></tr>
                                <tr><th style={thStyle}>위치/상권</th><td colSpan={3} style={tdStyle}>{data.locationMemo}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 2. Price Information */}
                    <div>
                        <h2 style={{ fontSize: '19px', borderLeft: '4px solid #fab005', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>금액 정보</h2>
                        <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                            <tbody>
                                <tr>
                                    <th style={thStyle}>보증금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.deposit)} 만원</td>
                                    <th style={thStyle}>임대료</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.monthlyRent)} 만원</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>권리금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.premium)} 만원</td>
                                    <th style={thStyle}>관리비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.maintenance)} 만원</td>
                                </tr>
                                <tr>
                                    <th style={{ ...thStyle, backgroundColor: '#fff9db' }}>합계</th>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#f03e3e', backgroundColor: '#fff9db' }}>{formatCurrency((data.deposit || 0) + (data.premium || 0))} 만원</td>
                                    <th style={thStyle}>부가세</th><td style={tdStyle}>{data.vat || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 3. Operations */}
                    <div>
                        <h2 style={{ fontSize: '19px', borderLeft: '4px solid #12b886', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>운영 및 매출 분석</h2>
                        <table className="report-table" style={{ width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                            <tbody>
                                <tr>
                                    <th style={thStyle}>월 총매출</th><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#1c7ed6' }}>{formatCurrency(data.monthlyRevenue)} 만원</td>
                                    <th style={thStyle}>인건비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.laborCost)} 만원</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>재료비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.materialCost)}</td>
                                    <th style={{ ...thStyle, whiteSpace: 'nowrap' }}>임대/관리비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.rentMaintenance)} 만원</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>제세공과금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.taxUtilities)} 만원</td>
                                    <th style={thStyle}>유지보수비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.maintenanceDepreciation)} 만원</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>홍보/기타</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.promoMisc)} 만원</td>
                                    <th style={{ ...thStyle, backgroundColor: '#e6fcf5', whiteSpace: 'nowrap' }}>월 예상수익</th>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0ca678', backgroundColor: '#e6fcf5' }}>
                                        {formatCurrency(data.monthlyProfit)} 만원
                                        <span style={{ fontSize: '12px', color: '#495057', marginLeft: '6px' }}>({data.yieldPercent ? Number(data.yieldPercent).toFixed(1) : '0'}%)</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 4. Lease Rights Analysis (Moved) - Condensed (3 items per row) */}
                    <div>
                        <h2 style={{ fontSize: '19px', borderLeft: '4px solid #228be6', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>임대차 권리 분석</h2>
                        <table className="report-table" style={{ width: '100%', fontSize: '13px', tableLayout: 'auto' }}>
                            <tbody>
                                <tr>
                                    <th style={{ ...thStyle, width: 'auto', whiteSpace: 'nowrap' }}>임대기간</th><td style={tdStyle}>{data.leasePeriod || '-'}</td>
                                    <th style={{ ...thStyle, width: 'auto', whiteSpace: 'nowrap' }}>임대료변동</th><td style={tdStyle}>{data.rentFluctuation || '-'}</td>
                                    <th style={{ ...thStyle, width: 'auto', whiteSpace: 'nowrap' }}>공부서류하자</th><td style={tdStyle}>{data.docDefects || '-'}</td>
                                </tr>
                                <tr>
                                    <th style={{ ...thStyle, width: 'auto', whiteSpace: 'nowrap' }}>양수도통보</th><td style={tdStyle}>{data.transferNotice || '-'}</td>
                                    <th style={{ ...thStyle, width: 'auto', whiteSpace: 'nowrap' }}>화해조서/공증</th><td style={tdStyle}>{data.settlementDefects || '-'}</td>
                                    <th style={{ ...thStyle, width: 'auto', whiteSpace: 'nowrap' }}>동업권리관계</th><td style={tdStyle}>{data.partnershipRights || '-'}</td>
                                </tr>
                                <tr>
                                    <th style={{ ...thStyle, width: 'auto', whiteSpace: 'nowrap' }}>임대인 정보</th><td colSpan={5} style={tdStyle}>{data.lessorInfo || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>

                {/* Right Column: Memos (Less items, more gap) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '17px', borderBottom: '2px solid #333', paddingBottom: '8px', marginBottom: '10px', color: '#333' }}>물건 메모</h2>
                        <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '13px', lineHeight: '1.6', height: '100%', minHeight: '220px' }}>
                            {data.overviewMemo || '-'}
                        </div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '17px', borderBottom: '2px solid #fd7e14', paddingBottom: '8px', marginBottom: '10px', color: '#333' }}>가맹 메모</h2>
                        <div style={{ padding: '15px', backgroundColor: '#fff4e6', borderRadius: '4px', fontSize: '13px', lineHeight: '1.6', height: '100%', minHeight: '220px' }}>
                            {data.franchiseMemo || '-'}
                        </div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '17px', borderBottom: '2px solid #82c91e', paddingBottom: '8px', marginBottom: '10px', color: '#333' }}>영업 메모</h2>
                        <div style={{ padding: '15px', backgroundColor: '#f4fce3', borderRadius: '4px', fontSize: '13px', lineHeight: '1.6', height: '100%', minHeight: '220px' }}>
                            {data.operationMemo || '-'}
                        </div>
                    </div>
                </div>
            </div>



            {/* Bottom: Revenue & Lease Memo (Split 50/50) */}
            <div style={{ display: 'grid', gridTemplateColumns: '48% 48%', gap: '30px', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #12b886', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>매출 메모</h2>
                    <div style={{ padding: '20px', backgroundColor: '#e6fcf5', borderRadius: '4px', fontSize: '14px', lineHeight: '1.6', minHeight: '250px' }}>
                        {data.revenueMemo || '-'}
                    </div>
                </div>
                <div>
                    <h2 style={{ fontSize: '19px', borderLeft: '4px solid #228be6', paddingLeft: '10px', marginBottom: '15px', color: '#333' }}>임대차 메모</h2>
                    <div style={{ padding: '20px', backgroundColor: '#e7f5ff', borderRadius: '4px', fontSize: '14px', lineHeight: '1.6', minHeight: '250px' }}>
                        {data.leaseMemo || '-'}
                    </div>
                </div>
            </div>


        </>
    );

    const renderFormat5 = () => {
        // Data for Pie Charts
        const expenseData = [
            { name: '인건비', value: data.laborCost || 0, color: '#FF8042' },
            { name: '재료비', value: data.materialCost || 0, color: '#FFBB28' },
            { name: '임대/관리', value: data.rentMaintenance || 0, color: '#00C49F' },
            { name: '공과금', value: data.taxUtilities || 0, color: '#0088FE' },
            { name: '기타', value: data.promoMisc || 0, color: '#8884d8' },
        ].filter(item => item.value > 0);

        const revenueData = [
            { name: '순이익', value: data.monthlyProfit || 0, color: '#0ca678' },
            { name: '총지출', value: (data.monthlyRevenue || 0) - (data.monthlyProfit || 0), color: '#fa5252' },
        ].filter(item => item.value > 0);

        // Helper for currency sum
        const totalStartup = (data.deposit || 0) + (data.premium || 0);

        const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
            const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
            const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

            return (
                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                    {`${(percent * 100).toFixed(0)}%`}
                </text>
            );
        };

        return (
            <>
                {/* Header */}
                {/* Header */}
                <div className="format5-header" style={{ borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                    <div>
                        <h1 style={{ fontSize: '33px', fontWeight: 'bold', margin: '0 0 10px 0' }}>매물 상세 리포트</h1>
                        <div style={{ fontSize: '15px', color: '#666', marginBottom: '4px' }}>발행일: {new Date().toLocaleDateString('ko-KR')}</div>
                        <div style={{ fontSize: '15px', color: '#333' }}>담당자: <span style={{ fontWeight: 'bold' }}>{data.managerName}</span> {data.managerPhone && `(${data.managerPhone})`}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '25px', fontWeight: 'bold', color: '#1c7ed6' }}>{data.name || '제목 없음'}</div>
                        <div style={{ fontSize: '17px', fontWeight: 'bold' }}>{data.address || ''}</div>
                    </div>
                </div>

                {/* 1. Property Overview Grid */}
                <div className="format5-compact-margin" style={{ marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '16px', borderLeft: '4px solid #333', paddingLeft: '8px', marginBottom: '10px', color: '#333' }}>물건 개요</h2>
                    <table className="report-table" style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <th style={thStyle}>업종</th><td style={tdStyle}>{data.industryCategory} {'>'} {data.industrySector}</td>
                                <th style={thStyle}>층수</th><td style={tdStyle}>{data.currentFloor}층 / {data.totalFloor}층</td>
                                <th style={thStyle}>면적</th><td style={tdStyle}>{data.area} m²</td>
                            </tr>
                            <tr>
                                <th style={thStyle}>특징</th><td colSpan={3} style={tdStyle}>{data.featureMemo}</td>
                                <th style={thStyle}>상권현황</th><td style={tdStyle}>{data.locationMemo}</td>
                            </tr>
                            <tr>
                                <th style={thStyle}>시설/인테리어</th><td style={tdStyle}>{/* Placeholder */} 상태 양호</td>
                                <th style={thStyle}>주요고객층</th><td style={tdStyle}>{/* Placeholder */} 20~30대 직장인</td>
                                <th style={thStyle}>피크타임</th><td style={tdStyle}>{/* Placeholder */} 점심 12:00~13:00</td>
                            </tr>
                            <tr>
                                <th style={thStyle}>관리비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.maintenance)} 만원</td>
                                <th style={thStyle}>총창업비용</th><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#f03e3e' }}>{formatCurrency(totalStartup)} 만원</td>
                                <th style={thStyle}>권리금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.premium)} 만원</td>
                            </tr>
                            <tr>
                                <th style={thStyle}>보증금</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.deposit)} 만원</td>
                                <th style={thStyle}>월 임대료</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.monthlyRent)} 만원</td>
                                <th style={thStyle}>합계(보+권)</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency((data.deposit || 0) + (data.premium || 0))} 만원</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 2. Photo & Financials Split */}
                <div className="format5-compact-margin" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    {/* Left: Photo */}
                    <div style={{ position: 'relative', backgroundColor: '#f1f3f5', borderRadius: '4px', border: '1px solid #eee', overflow: 'hidden' }}>
                        {data.photos && data.photos.length > 0 ? (
                            <img src={data.photos[0]} alt="Property" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: '#adb5bd' }}>이미지 없음</span>
                            </div>
                        )}
                    </div>

                    {/* Right: Revenue & Expense Tables */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {/* Revenue */}
                        <div>
                            <h3 style={{ fontSize: '14px', marginBottom: '5px', borderLeft: '3px solid #1c7ed6', paddingLeft: '6px' }}>매출 현황</h3>
                            <table className="report-table" style={{ width: '100%', fontSize: '12px' }}>
                                <tbody>
                                    <tr><th style={thStyle}>월 매출</th><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(data.monthlyRevenue)} 만원</td></tr>
                                    <tr><th style={thStyle}>월 경비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency((data.monthlyRevenue || 0) - (data.monthlyProfit || 0))} 만원</td></tr>
                                    <tr><th style={thStyle}>순이익</th><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#1c7ed6' }}>{formatCurrency(data.monthlyProfit)} 만원</td></tr>
                                    <tr><th style={{ ...thStyle, backgroundColor: '#e6fcf5' }}>수익률</th><td style={{ ...tdStyle, backgroundColor: '#e6fcf5', textAlign: 'right', fontWeight: 'bold' }}>{Number(data.yieldPercent).toFixed(1)}%</td></tr>
                                </tbody>
                            </table>
                        </div>
                        {/* Expenses */}
                        <div>
                            <h3 style={{ fontSize: '14px', marginBottom: '5px', borderLeft: '3px solid #fa5252', paddingLeft: '6px' }}>지출 경비 현황</h3>
                            <table className="report-table" style={{ width: '100%', fontSize: '12px' }}>
                                <tbody>
                                    <tr>
                                        <th style={thStyle}>인건비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.laborCost)} 만원</td>
                                        <th style={thStyle}>재료비</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.materialCost)} 만원</td>
                                    </tr>
                                    <tr>
                                        <th style={thStyle}>임대/관리</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(data.rentMaintenance)} 만원</td>
                                        <th style={thStyle}>공과/기타</th><td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency((data.taxUtilities || 0) + (data.promoMisc || 0))} 만원</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 3. Charts & Map Split */}
                <div className="format5-compact-margin" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '20px', height: '200px' }}>
                    {/* Revenue Chart (Profit vs Expense) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '13px', marginBottom: '5px', color: '#555' }}>매출/수익 구성</h4>
                        <div style={{ width: '100%', height: '100%' }}>
                            {typeof window !== 'undefined' && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={revenueData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={30}
                                            outerRadius={60}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={renderCustomizedLabel}
                                            labelLine={false}
                                        >
                                            {revenueData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ fontSize: '11px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                    {/* Expense Chart (Breakdown) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '13px', marginBottom: '5px', color: '#555' }}>지출 경비 상세</h4>
                        <div style={{ width: '100%', height: '100%' }}>
                            {typeof window !== 'undefined' && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={expenseData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={30}
                                            outerRadius={60}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={renderCustomizedLabel}
                                            labelLine={false}
                                        >
                                            {expenseData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ fontSize: '11px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>

                {/* 4. Map (Bottom) */}
                <div className="map-container-format5" style={{ flex: 1, width: '100%', height: '480px', backgroundColor: '#f1f3f5', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '8px', borderLeft: '3px solid #228be6', paddingLeft: '6px', position: 'absolute', top: '10px', left: '10px', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: '4px' }}>위치 정보</h3>
                    <Map
                        center={{ lat: parseFloat(data.coordinates.lat), lng: parseFloat(data.coordinates.lng) }}
                        style={{ width: '100%', height: '100%' }}
                        level={3}
                        onCreate={setMap}
                        onClick={(_map, mouseEvent) => handleMapClick(mouseEvent)}
                        onMouseMove={(_map, mouseEvent) => handleMouseMove(mouseEvent)}
                        onRightClick={() => handleRightClick()}
                    >
                        <MapMarker position={{ lat: parseFloat(data.coordinates.lat), lng: parseFloat(data.coordinates.lng) }} />
                        <div className="print-hide" style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '5px',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            padding: '5px 4px',
                            borderRadius: '20px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            border: '1px solid #dee2e6'
                        }}>
                            {/* Toggle Button */}
                            <button
                                onClick={() => setIsToolbarOpen(!isToolbarOpen)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: isToolbarOpen ? '#f1f3f5' : 'transparent',
                                    color: '#495057',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                title={isToolbarOpen ? '도구 접기' : '지도 도구 열기'}
                            >
                                {isToolbarOpen ? <ChevronRight size={14} style={{ transform: 'rotate(-90deg)' }} /> : <Settings size={14} />}
                            </button>

                            {isToolbarOpen && (
                                <>
                                    <div style={{ width: '80%', height: '1px', backgroundColor: '#dee2e6', margin: '2px 0' }} />
                                    {[
                                        { mode: null, icon: <MousePointer2 size={14} />, label: '선택' },
                                        { mode: 'distance', icon: <Ruler size={14} />, label: '거리' },
                                        { mode: 'circle_radius', icon: <CircleIcon size={14} />, label: '반경' },
                                        { mode: 'area', icon: <Pentagon size={14} />, label: '면적' },
                                    ].map((tool) => (
                                        <button
                                            key={tool.label}
                                            onClick={() => setDrawingMode(tool.mode)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '4px',
                                                padding: '6px',
                                                width: '100%',
                                                borderRadius: '8px',
                                                border: '1px solid',
                                                borderColor: drawingMode === tool.mode ? '#228be6' : 'transparent',
                                                backgroundColor: drawingMode === tool.mode ? '#e7f5ff' : 'transparent',
                                                color: drawingMode === tool.mode ? '#1c7ed6' : '#495057',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                            title={tool.label}
                                        >
                                            {tool.icon}
                                            <span style={{ fontSize: '10px' }}>{tool.label}</span>
                                        </button>
                                    ))}
                                    <div style={{ width: '80%', height: '1px', backgroundColor: '#dee2e6', margin: '2px 0' }} />
                                    <button
                                        onClick={handleClearAll}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px',
                                            padding: '6px',
                                            width: '100%',
                                            borderRadius: '8px',
                                            border: '1px solid transparent',
                                            backgroundColor: 'transparent',
                                            color: '#fa5252',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                        title="전체 지우기"
                                    >
                                        <Trash2 size={14} />
                                        <span style={{ fontSize: '10px' }}>지우기</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </Map>
                </div>
            </>
        );
    };

    return (
        <div
            id="print-root"
            className="preview-canvas"
        >
            <style>{printStyles}</style>
            <style>{`
                .report-table th, .report-table td {
                    border-bottom: 1px solid #f1f3f5;
                    padding: 8px 10px;
                    vertical-align: middle;
                }
                .report-table th {
                    background-color: #f8f9fa;
                    font-weight: 600;
                    color: #495057;
                    text-align: left;
                    width: 90px;
                }
            `}</style>
            <div className="print-sheet">
                {format === '5' ? renderFormat5() : (format === '4' ? renderFormat4() : (format === '3' ? renderFormat3() : (format === '2' ? renderFormat2() : renderFormat1())))}
            </div>
        </div>
    );
};

export default PropertyReportPrint;
