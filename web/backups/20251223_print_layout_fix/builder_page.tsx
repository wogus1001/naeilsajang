"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Bold, Italic as ItalicIcon, Underline as UnderlineIcon, Highlighter,
    AlignLeft, AlignCenter, AlignRight,
    Type, Calendar, Hash, PenTool, Save, X,
    Heading1, Heading2, Table as TableIcon,
    PlusSquare, Columns, Trash, FilePlus,
    Undo, Redo, Indent as IndentIcon, Outdent as OutdentIcon, Image as ImageIcon, Eraser,
    ChevronLeft, ChevronRight, FileMinus, Scissors, MessageSquare
} from 'lucide-react';
import { ContractTemplate, FormField } from '@/types/contract-core';
import { getTemplateById, getAllTemplates } from '@/lib/templates/registry';

const PAGE_DELIMITER = '<!-- GENUINE_PAGE_BREAK -->';

export default function TemplateBuilderPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = searchParams.get('projectId');
    const returnToProject = searchParams.get('returnToProject');
    const templateId = searchParams.get('templateId');

    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('기타');
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

    // Multi-page State
    const [pages, setPages] = useState<string[]>(['<h1 style="text-align: center;">계약서 제목</h1><p><br/></p><p>제 1 조 (목적)</p><p>본 계약은 ...</p>']);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);

    const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

    // --- State Management for Current Page ---
    // When switching pages, we must save the current editor content back to the pages array
    const saveCurrentPageContent = () => {
        if (editorRef.current) {
            const content = editorRef.current.innerHTML;
            setPages(prev => {
                const newPages = [...prev];
                newPages[currentPageIndex] = content;
                return newPages;
            });
        }
    };

    // Update editor content when page index changes (OR when pages are loaded/initialised)
    useEffect(() => {
        if (editorRef.current) {
            // Only update if the content is different to avoid cursor jumps during typing 
            // (though normally pages is only updated on blur/navigation)
            const currentContent = editorRef.current.innerHTML;
            const newContent = pages[currentPageIndex] || '';
            if (currentContent !== newContent) {
                editorRef.current.innerHTML = newContent;
            }
        }
    }, [currentPageIndex, pages]);

    // LOAD EXISTING TEMPLATE
    useEffect(() => {
        if (templateId) {
            const templates = getAllTemplates();
            const template = templates.find(t => t.id === templateId);

            if (template) {
                setEditingTemplateId(templateId);
                setTitle(template.name);
                setCategory(template.category);

                // Restore Pages and Variables
                const rawHTML = template.htmlTemplate;
                const pageStrings = rawHTML.split(PAGE_DELIMITER);

                const processedPages = pageStrings.map(html => {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;

                    // Find all {{key}} patterns and restore them as spans
                    // Since the current registry has simple {{key}} placeholders, 
                    // we need to match them and find the corresponding label from formSchema.

                    let processedHTML = html;
                    template.formSchema.forEach(field => {
                        if (field.type === 'section') return;

                        const placeholder = `{{${field.key}}}`;
                        const spanHTML = `<span style="background-color: rgb(231, 245, 255); color: rgb(25, 113, 194); padding: 2px 6px; border-radius: 4px; border: 1px solid rgb(165, 216, 255); margin: 0px 2px; font-size: 0.9em; font-weight: 500; display: inline-block;" data-type="variable" data-var-type="${field.type}" data-key="${field.key}" data-label="${field.label}">{{${field.label}}}</span>`;

                        // Use regex for global replacement
                        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                        processedHTML = processedHTML.replace(regex, spanHTML);
                    });

                    return processedHTML;
                });

                setPages(processedPages);
                setCurrentPageIndex(0);

                // Explicitly sync to editor immediately after loading
                if (editorRef.current && processedPages[0]) {
                    editorRef.current.innerHTML = processedPages[0];
                }
            }
        }
    }, [templateId]);

    // Auto-save content to state on blur or interval could be good, but for now we rely on explicit actions
    // Let's add a blur listener to save content
    const handleBlur = () => {
        saveCurrentPageContent();
    };

    // --- Format Tracking ---
    React.useEffect(() => {
        const checkFormat = () => {
            if (!document) return;
            setActiveFormats({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                justifyLeft: document.queryCommandState('justifyLeft'),
                justifyCenter: document.queryCommandState('justifyCenter'),
                justifyRight: document.queryCommandState('justifyRight'),
                backColor: document.queryCommandValue('backColor') !== 'rgba(0, 0, 0, 0)' && document.queryCommandValue('backColor') !== 'transparent' && document.queryCommandValue('backColor') !== 'rgb(255, 255, 255)'
            });
        };

        document.addEventListener('selectionchange', checkFormat);
        return () => document.removeEventListener('selectionchange', checkFormat);
    }, []);

    // --- Commands ---
    const execCmd = (command: string, value: string | undefined = undefined) => {
        if (command === 'backColor' && value) {
            const currentColor = document.queryCommandValue('backColor');
            const isActive = currentColor !== 'rgba(0, 0, 0, 0)' && currentColor !== 'transparent' && currentColor !== 'rgb(255, 255, 255)';
            if (isActive) {
                document.execCommand('backColor', false, 'transparent');
                return;
            }
        }
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    };

    // --- Table Operations ---
    const getSelectedTable = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        let node = selection.anchorNode as HTMLElement | null;
        while (node && node.nodeName !== 'BODY') {
            if (node.nodeName === 'TD' || node.nodeName === 'TH') return { cell: node, row: node.parentNode as HTMLTableRowElement, table: node.parentNode?.parentNode?.parentNode as HTMLTableElement };
            node = node.parentNode as HTMLElement;
        }
        return null;
    };

    const insertTable = () => {
        const html = `
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                <tbody>
                    <tr><td style="border: 1px solid #ddd; padding: 8px;">&nbsp;</td><td style="border: 1px solid #ddd; padding: 8px;">&nbsp;</td></tr>
                    <tr><td style="border: 1px solid #ddd; padding: 8px;">&nbsp;</td><td style="border: 1px solid #ddd; padding: 8px;">&nbsp;</td></tr>
                </tbody>
            </table>
        `;
        execCmd('insertHTML', html);
    };

    const addTableRow = () => {
        const data = getSelectedTable();
        if (!data) return alert('표 내부를 클릭해주세요.');
        const { row } = data;
        const newRow = row.cloneNode(true) as HTMLTableRowElement;
        Array.from(newRow.cells).forEach(cell => cell.innerHTML = '&nbsp;');
        row.after(newRow);
    };

    const addTableCol = () => {
        const data = getSelectedTable();
        if (!data) return alert('표 내부를 클릭해주세요.');
        const { cell, table } = data;
        const cellIndex = (cell as HTMLTableCellElement).cellIndex;
        Array.from(table.rows).forEach(r => {
            const newCell = r.cells[cellIndex].cloneNode(true) as HTMLTableCellElement;
            newCell.innerHTML = '&nbsp;';
            r.cells[cellIndex].after(newCell);
        });
    };

    const deleteTable = () => {
        const data = getSelectedTable();
        if (!data) return alert('표 내부를 클릭해주세요.');
        if (confirm('현재 표를 삭제하시겠습니까?')) {
            data.table.remove();
        }
    };

    // --- Image Upload ---
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            execCmd('insertImage', base64);
            // Optional: Resize image style here if needed
            // But standard insertImage works.
        };
        reader.readAsDataURL(file);

        // Reset input
        e.target.value = '';
    };

    const triggerImageUpload = () => {
        fileInputRef.current?.click();
    };

    // --- Page Operations ---
    const insertPageDivide = () => {
        const html = `<div contenteditable="false" style="border-bottom: 2px dashed #adb5bd; margin: 20px 0; display: flex; align-items: center; justify-content: center; color: #868e96; font-size: 12px;">-- 페이지 나누기 --</div><div><br></div>`;
        execCmd('insertHTML', html);
    };

    const addNewPage = () => {
        saveCurrentPageContent();
        setPages(prev => [...prev, '<p><br/></p>']);
        setCurrentPageIndex(prev => prev + 1); // Move to new page
    };

    const deleteCurrentPage = () => {
        if (pages.length <= 1) {
            alert('최소 1페이지는 존재해야 합니다.');
            return;
        }
        if (!confirm(`${currentPageIndex + 1}페이지를 삭제하시겠습니까? 복구할 수 없습니다.`)) return;

        setPages(prev => {
            const newPages = prev.filter((_, idx) => idx !== currentPageIndex);
            return newPages;
        });

        // Adjust index if we deleted the last page
        if (currentPageIndex >= pages.length - 1) {
            setCurrentPageIndex(Math.max(0, pages.length - 2));
        }
    };

    const goPrevPage = () => {
        if (currentPageIndex > 0) {
            saveCurrentPageContent();
            setCurrentPageIndex(prev => prev - 1);
        }
    };

    const goNextPage = () => {
        if (currentPageIndex < pages.length - 1) {
            saveCurrentPageContent();
            setCurrentPageIndex(prev => prev + 1);
        }
    };

    // --- Variable Insertion ---
    const insertVariable = (type: 'text' | 'date' | 'currency' | 'signature') => {
        const selection = window.getSelection();
        if (!selection || !editorRef.current?.contains(selection.anchorNode)) {
            alert('편집 영역에 커서를 위치시켜주세요.');
            return;
        }

        const label = prompt('이 필드의 이름(라벨)을 입력하세요: (예: 매수인 성명)');
        if (!label) return;

        const key = label.trim().replace(/\s+/g, '_');

        const span = document.createElement('span');
        // Removed contentEditable="false" to allow formatting
        span.style.backgroundColor = '#e7f5ff';
        span.style.color = '#1971c2';
        span.style.padding = '2px 6px';
        span.style.borderRadius = '4px';
        span.style.border = '1px solid #a5d8ff';
        span.style.margin = '0 2px';
        span.style.fontSize = '0.9em';
        span.style.fontWeight = '500';
        span.style.display = 'inline-block';
        span.dataset.type = 'variable';
        span.dataset.varType = type;
        span.dataset.key = key;
        span.dataset.label = label;
        span.innerText = `{{${label}}}`;

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(span);

        // Add a non-breaking space after to ensure cursor can move out
        const space = document.createTextNode('\u00A0');
        range.setStartAfter(span);
        range.insertNode(space);

        range.setStartAfter(space);
        range.setEndAfter(space);
        selection.removeAllRanges();
        selection.addRange(range);

        // Focus editor again just in case
        editorRef.current?.focus();
    };

    // --- Page Overflow Protection ---
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!editorRef.current) return;
        const { scrollHeight, clientHeight } = editorRef.current;

        // Using a small threshold (e.g., 1px) to detect overflow
        if (scrollHeight > clientHeight + 1) {
            // Allow navigation and deletion
            const allowedKeys = ['Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];
            // Allow shortcuts (Ctrl+C, Ctrl+V, etc.)
            if ((e.ctrlKey || e.metaKey)) return;

            if (!allowedKeys.includes(e.key)) {
                e.preventDefault();
                alert('페이지 공간이 부족합니다. 새로운 페이지를 추가하거나 내용을 줄여주세요.');
                return;
            }
        }
    };

    // --- Save ---
    const handleSave = () => {
        // First save current content
        if (editorRef.current) {
            pages[currentPageIndex] = editorRef.current.innerHTML;
        }

        if (!title.trim()) {
            alert('템플릿 제목을 입력해주세요.');
            return;
        }

        // Join pages
        const fullContent = pages.join(PAGE_DELIMITER);
        const schema: FormField[] = [];

        const parser = new DOMParser();
        const doc = parser.parseFromString(fullContent, 'text/html');
        // We only parse schema from valid variable nodes, 
        // Note: PAGE_DELIMITER is basically a string separator, parser will treat it as text or comment.
        // It won't affect Variable parsing.

        const varNodes = doc.querySelectorAll('span[data-type="variable"]');
        varNodes.forEach((node: any) => {
            const key = node.dataset.key;
            schema.push({
                key,
                label: node.dataset.label,
                type: node.dataset.varType as any,
                placeholder: `${node.dataset.label}을(를) 입력하세요`
            });
            // Replace for final HTML
            node.replaceWith(`{{${key}}}`);
        });

        const storageHTML = doc.body.innerHTML;

        try {
            const existingStr = localStorage.getItem('custom_templates');
            const existing: ContractTemplate[] = existingStr ? JSON.parse(existingStr) : [];

            let finalId = '';

            if (editingTemplateId && editingTemplateId.startsWith('usr-t-')) {
                // UPDATE EXISTING CUSTOM TEMPLATE
                finalId = editingTemplateId;
                const index = existing.findIndex(t => t.id === editingTemplateId);
                if (index !== -1) {
                    existing[index] = {
                        ...existing[index],
                        name: title,
                        category,
                        formSchema: schema,
                        htmlTemplate: storageHTML,
                        updatedAt: new Date().toISOString()
                    };
                } else {
                    existing.push({
                        id: finalId,
                        name: title,
                        category,
                        formSchema: schema,
                        htmlTemplate: storageHTML,
                        description: '사용자 정의 템플릿'
                    });
                }
                localStorage.setItem('custom_templates', JSON.stringify(existing));
                alert('템플릿이 수정되었습니다!');
            } else {
                // CREATE NEW (OR SAVE AS FROM SYSTEM)
                finalId = `usr-t-${Date.now()}`;
                const newTemplate: ContractTemplate = {
                    id: finalId,
                    name: title,
                    category,
                    formSchema: schema.filter((v, i, a) => a.findIndex(t => t.key === v.key) === i),
                    htmlTemplate: storageHTML,
                    description: '사용자 정의 템플릿',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                existing.push(newTemplate);
                localStorage.setItem('custom_templates', JSON.stringify(existing));
                alert('템플릿이 저장되었습니다!');
            }

            if (projectId && returnToProject) {
                router.push(`/contracts/project/${projectId}?newDoc=${finalId}`);
            } else {
                router.push('/contracts');
            }
        } catch (e) {
            console.error(e);
            alert('저장 실패');
        }
    };

    return (
        <div style={styles.container} className="builder-container">
            <style jsx global>{`
                /* Common Document Styling for both Builder and Viewer */
                .contract-preview h1 { margin: 0 0 40px 0; padding: 0; line-height: 1.2; font-size: 2.2em; font-weight: 700; text-align: center; }
                .contract-preview h2 { margin: 30px 0 15px 0; padding: 0; line-height: 1.3; font-size: 1.5em; font-weight: 700; border-bottom: 2px solid #333; padding-bottom: 5px; }
                .contract-preview h3 { margin: 25px 0 10px 0; padding: 0; line-height: 1.3; font-size: 1.25em; font-weight: 700; }
                .contract-preview p { margin: 0 0 15px 0; line-height: 1.6; }
                
                .contract-preview .section { margin-bottom: 30px; }
                
                .contract-preview table { 
                    width: 100% !important; 
                    border-collapse: collapse !important; 
                    margin-bottom: 20px !important;
                    table-layout: fixed !important; 
                }
                .contract-preview table td { 
                    border: 1px solid #adb5bd !important; 
                    padding: 10px 12px !important; 
                    word-break: break-all !important;
                }
                .contract-preview table .label { 
                    background-color: #f8f9fa !important; 
                    font-weight: 600 !important; 
                    width: 120px;
                }
                .contract-preview table .money { text-align: right !important; }

                @media print {
                @media print {
                    /* Hide UI Elements by Class */
                    .builder-header,
                    .builder-pagination,
                    input[type="file"],
                    button {
                        display: none !important;
                    }

                    /* Reset Containers */
                    .builder-container, 
                    .builder-workspace {
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                    }

                    /* Content Preview */
                    .contract-preview {
                        position: relative !important;
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 20mm !important;
                        box-sizing: border-box !important;
                        background-color: white !important;
                        box-shadow: none !important;
                    }

                    @page { size: A4; margin: 0; }
                    html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: visible; background: white; }
                }
                }
            `}</style>
            {/* HIDDEN INPUT FOR IMAGE */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleImageUpload}
            />

            {/* HEADER / TOOLBAR */}
            <div style={styles.header} className="builder-header">
                {/* Row 1: Meta + Actions */}
                <div style={{ ...styles.toolbarRow, padding: '12px 20px 8px 20px', borderBottom: '1px solid #f8f9fa' }}>
                    <input
                        type="text"
                        placeholder="템플릿 제목 입력"
                        style={styles.titleInput}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <select
                        style={styles.select}
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="기타">카테고리 선택</option>
                        <option value="부동산">부동산</option>
                        <option value="고용/인사">고용/인사</option>
                        <option value="비즈니스">비즈니스</option>
                        <option value="법률">법률</option>
                    </select>

                    <div style={{ flex: 1 }} />

                    <button onClick={() => router.back()} style={styles.cancelBtn}>취소</button>
                    <button onClick={handleSave} style={styles.saveBtn}>
                        <Save size={16} /> 템플릿 저장
                    </button>
                </div>

                {/* Separator Removed */}

                {/* Row 2: Editor Tools */}
                <div style={{ ...styles.toolbarRow, padding: '8px 20px' }}>
                    <button onClick={() => execCmd('undo')} title="실행 취소" style={styles.toolBtn}><Undo size={18} /></button>
                    <button onClick={() => execCmd('redo')} title="다시 실행" style={styles.toolBtn}><Redo size={18} /></button>

                    <div style={styles.separator} />

                    <button onClick={() => execCmd('formatBlock', 'H1')} title="제목 1" style={styles.toolBtn}><Heading1 size={18} /></button>
                    <button onClick={() => execCmd('formatBlock', 'H3')} title="제목 2" style={styles.toolBtn}><Heading2 size={18} /></button>
                    <button
                        onClick={() => execCmd('bold')}
                        title="굵게"
                        style={{ ...styles.toolBtn, backgroundColor: activeFormats.bold ? '#e9ecef' : 'transparent', color: activeFormats.bold ? '#1971c2' : '#495057' }}
                    >
                        <Bold size={18} />
                    </button>
                    <button
                        onClick={() => execCmd('italic')}
                        title="기울임"
                        style={{ ...styles.toolBtn, backgroundColor: activeFormats.italic ? '#e9ecef' : 'transparent', color: activeFormats.italic ? '#1971c2' : '#495057' }}
                    >
                        <ItalicIcon size={18} />
                    </button>
                    <button
                        onClick={() => execCmd('underline')}
                        title="밑줄"
                        style={{ ...styles.toolBtn, backgroundColor: activeFormats.underline ? '#e9ecef' : 'transparent', color: activeFormats.underline ? '#1971c2' : '#495057' }}
                    >
                        <UnderlineIcon size={18} />
                    </button>
                    <button
                        onClick={() => execCmd('backColor', '#fff3cd')}
                        title="형광펜"
                        style={{ ...styles.toolBtn, backgroundColor: activeFormats.backColor ? '#fff3cd' : 'transparent', color: activeFormats.backColor ? '#e67700' : '#495057' }}
                    >
                        <Highlighter size={18} />
                    </button>
                    <button
                        onClick={() => execCmd('foreColor', '#adb5bd')}
                        title="안내 문구(연한 회색)"
                        style={styles.toolBtn}
                    >
                        <MessageSquare size={18} color="#adb5bd" />
                    </button>
                    <button onClick={() => execCmd('removeFormat')} title="서식 지우기" style={styles.toolBtn}><Eraser size={18} /></button>

                    <div style={styles.separator} />

                    <button onClick={() => execCmd('justifyLeft')} title="왼쪽" style={{ ...styles.toolBtn, backgroundColor: activeFormats.justifyLeft ? '#e9ecef' : 'transparent' }}><AlignLeft size={18} /></button>
                    <button onClick={() => execCmd('justifyCenter')} title="가운데" style={{ ...styles.toolBtn, backgroundColor: activeFormats.justifyCenter ? '#e9ecef' : 'transparent' }}><AlignCenter size={18} /></button>
                    <button onClick={() => execCmd('justifyRight')} title="오른쪽" style={{ ...styles.toolBtn, backgroundColor: activeFormats.justifyRight ? '#e9ecef' : 'transparent' }}><AlignRight size={18} /></button>

                    <button onClick={() => execCmd('outdent')} title="내어쓰기" style={styles.toolBtn}><OutdentIcon size={18} /></button>
                    <button onClick={() => execCmd('indent')} title="들여쓰기" style={styles.toolBtn}><IndentIcon size={18} /></button>

                    <div style={styles.separator} />

                    <button onClick={insertTable} title="표 삽입" style={styles.toolBtn}><TableIcon size={18} /></button>
                    <button onClick={addTableRow} title="행 추가" style={styles.toolBtn}><PlusSquare size={18} /></button>
                    <button onClick={addTableCol} title="열 추가" style={styles.toolBtn}><Columns size={18} /></button>
                    <button onClick={deleteTable} title="표 삭제" style={{ ...styles.toolBtn, color: '#fa5252' }}><Trash size={18} /></button>

                    <div style={styles.separator} />

                    <button onClick={triggerImageUpload} title="이미지 (JPG, PNG)" style={styles.toolBtn}><ImageIcon size={18} /></button>
                    <button onClick={insertPageDivide} title="페이지 나누기 (점선)" style={styles.toolBtn}><Scissors size={18} /></button>

                    <div style={styles.separator} />

                    <button onClick={addNewPage} title="새 페이지 추가" style={styles.toolBtn}><FilePlus size={18} /></button>
                    <button onClick={deleteCurrentPage} title="현재 페이지 삭제" style={{ ...styles.toolBtn, color: '#fa5252' }}><FileMinus size={18} /></button>

                    {/* Check if variable insertions are needed here or in a separate row */}
                </div>

                {/* Row 3: Variables (Optional/Compact) */}
                <div style={{ ...styles.toolbarRow, marginTop: '8px', paddingBottom: '4px' }}>
                    <span style={styles.label}>변수 삽입:</span>
                    <button onClick={() => insertVariable('text')} style={styles.varBtn}><Type size={14} /> 텍스트</button>
                    <button onClick={() => insertVariable('date')} style={styles.varBtn}><Calendar size={14} /> 날짜</button>
                    <button onClick={() => insertVariable('currency')} style={styles.varBtn}><Hash size={14} /> 금액</button>
                    <button onClick={() => insertVariable('signature')} style={styles.varBtn}><PenTool size={14} /> 서명</button>
                </div>
            </div>

            {/* EDITOR CANVAS */}
            <div style={styles.workspace} className="builder-workspace">
                <div style={styles.pageContainer}>
                    {/* A4 Page View */}
                    <div
                        ref={editorRef}
                        contentEditable
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        style={styles.paper}
                        className="contract-preview"
                        spellCheck={false}
                    />

                    {/* Page Info Loop */}
                    <div style={styles.pageInfo}>
                        {currentPageIndex + 1} / {pages.length} 페이지
                    </div>
                </div>
            </div>

            {/* BOTTOM PAGINATION BAR */}
            <div style={styles.paginationBar} className="builder-pagination">
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={deleteCurrentPage} style={styles.pageActionBtn} title="현재 페이지 삭제">
                        <FileMinus size={16} /> 페이지 삭제
                    </button>
                </div>

                <div style={styles.pageNav}>
                    <button onClick={goPrevPage} disabled={currentPageIndex === 0} style={styles.navBtn}>
                        <ChevronLeft size={20} />
                    </button>
                    <span style={styles.pageIndicator}>
                        {currentPageIndex + 1}P
                    </span>
                    <button onClick={goNextPage} disabled={currentPageIndex === pages.length - 1} style={styles.navBtn}>
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Removed bottom Add Page button */}
                <div style={{ width: '80px' }} />
            </div>
        </div >
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        height: '100vh',
        backgroundColor: '#e9ecef', // Darker bg for contrast
        overflow: 'hidden'
    },
    header: {
        backgroundColor: 'white',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        flexDirection: 'column' as const,
        padding: '0', // Removed general padding to control row spacing
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        zIndex: 10
    },
    toolbarRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap' as const,
        padding: '0 20px' // Horizontal padding only, vertical handled individually
    },
    separator: {
        width: '1px',
        height: '24px',
        backgroundColor: '#dee2e6',
        margin: '0 5px'
    },
    titleInput: {
        border: '1px solid #ced4da',
        borderRadius: '4px',
        padding: '6px 12px',
        fontSize: '14px',
        width: '240px',
        fontWeight: 600
    },
    select: {
        border: '1px solid #ced4da',
        borderRadius: '4px',
        padding: '6px',
        fontSize: '14px'
    },
    toolBtn: {
        background: 'none',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        padding: '6px',
        color: '#495057',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s',
        minWidth: '32px'
    },
    varBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        backgroundColor: '#f1f3f5',
        color: '#495057',
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    label: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#868e96',
        marginRight: '6px'
    },
    cancelBtn: {
        padding: '8px 16px',
        border: '1px solid #dee2e6',
        backgroundColor: 'white',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500
    },
    saveBtn: {
        padding: '8px 16px',
        backgroundColor: '#4c6ef5',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '14px',
        fontWeight: 600,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    workspace: {
        flex: 1,
        overflowY: 'auto' as const,
        overflowX: 'auto' as const, // Enable horizontal scroll if width < A4
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 20px 100px 20px', // Add side padding to prevent touching edges
        backgroundColor: '#e9ecef'
    },
    pageContainer: {
        position: 'relative' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
        alignItems: 'center'
    },
    paper: {
        width: '210mm',
        minWidth: '210mm', // Prevent shrinking
        height: '297mm', // Fixed A4 Height
        minHeight: '297mm',
        backgroundColor: 'white',
        padding: '20mm',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        outline: 'none',
        fontSize: '16px',
        lineHeight: '1.6',
        color: '#212529',
        overflow: 'hidden', // Enforce A4 constraint
        position: 'relative' as const
    },
    pageInfo: {
        marginTop: '8px',
        fontSize: '12px',
        color: '#868e96',
        fontWeight: 500
    },
    paginationBar: {
        height: '60px',
        backgroundColor: 'white',
        borderTop: '1px solid #dee2e6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 30px',
        position: 'fixed' as const,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20
    },
    pageNav: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px'
    },
    navBtn: {
        backgroundColor: 'white',
        border: '1px solid #dee2e6',
        cursor: 'pointer',
        color: '#495057',
        width: '40px', // Fixed square size
        height: '40px',
        borderRadius: '4px', // Square with slight radius
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    },
    pageIndicator: {
        fontSize: '16px',
        fontWeight: 700,
        fontFamily: 'monospace',
        color: '#212529'
    },
    pageActionBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        backgroundColor: 'white',
        border: '1px solid #ced4da',
        borderRadius: '4px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        color: '#495057'
    }
};
