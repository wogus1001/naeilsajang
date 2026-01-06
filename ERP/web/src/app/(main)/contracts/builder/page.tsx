"use client";

import React, { useRef, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Bold, Italic as ItalicIcon, Underline as UnderlineIcon, Highlighter,
    AlignLeft, AlignCenter, AlignRight,
    Type, Calendar, Hash, PenTool, Save, X,
    Heading1, Heading2, Table as TableIcon,
    PlusSquare, Columns, Trash, FilePlus,
    Undo, Redo, Indent as IndentIcon, Outdent as OutdentIcon, Image as ImageIcon, Eraser,
    ChevronLeft, ChevronRight, FileMinus, Scissors, MessageSquare, WrapText,
    ArrowUpFromLine, MoveVertical
} from 'lucide-react';
import { ContractTemplate, FormField } from '@/types/contract-core';
import { getTemplateById, getAllTemplates, fetchCombinedTemplates } from '@/lib/templates/registry';
import { createClient } from '@/utils/supabase/client';

const PAGE_DELIMITER = '<!-- GENUINE_PAGE_BREAK -->';

const BuilderContent = () => {
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
    const [isSaving, setIsSaving] = useState(false);

    // Table Resizing State
    const resizingState = useRef<{
        isResizing: boolean;
        startX: number;
        startWidth: number;
        targetCell: HTMLTableCellElement | null;
    }>({
        isResizing: false,
        startX: 0,
        startWidth: 0,
        targetCell: null
    });

    // Image Resizing State
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
    const imgResizingState = useRef<{
        isResizing: boolean;
        startX: number;
        startWidth: number;
        startHeight: number;
        targetImg: HTMLImageElement | null;
    }>({
        isResizing: false,
        startX: 0,
        startWidth: 0,
        startHeight: 0,
        targetImg: null
    });

    // Multi-page State
    const [pages, setPages] = useState<string[]>(['<h1 style="text-align: center;">계약서 제목</h1><p><br/></p><p>제 1 조 (목적)</p><p>본 계약은 ...</p>']);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);

    const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
    const [currentFontSize, setCurrentFontSize] = useState('11pt');
    const [currentLineHeight, setCurrentLineHeight] = useState('1.6');
    const [currentParagraphSpacing, setCurrentParagraphSpacing] = useState('5px');

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
            fetchCombinedTemplates().then(templates => {
                const template = templates.find(t => t.id === templateId);

                if (template) {
                    setEditingTemplateId(templateId);
                    setTitle(template.name);
                    setCategory(template.category);

                    // Restore Pages and Variables
                    const rawHTML = template.htmlTemplate;
                    const pageStrings = rawHTML.split(PAGE_DELIMITER);




                    const processedPages = pageStrings.map(html => {
                        // 1. Basic hydration (String replace) - this handles plain text {{key}}
                        let processedHTML = html;
                        template.formSchema.forEach(field => {
                            if (field.type === 'section') return;
                            const placeholder = `{{${field.key}}}`;
                            // Escaped regex
                            const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            // Use Negative Lookahead to ensure not already inside a span? Hard in regex.

                            // Let's use the DOM wrapper approach.
                            // Parse HTML, find {{key}} in text nodes, replace with Element.
                            // This is robust.
                        });

                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = html;

                        // Un-double-wrap logic:
                        // If we have existing spans, they are preserved.
                        // If we run string replace on `tempDiv.innerHTML`, we risk nesting.

                        // Better Algorithm:
                        // 1. Parse HTML.
                        // 2. Find ALL text nodes.
                        // 3. For each text node, check if it contains `{{key}}`.
                        // 4. If parent is NOT variable span, replace text with variable span.

                        const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT);
                        const textNodes: Text[] = [];
                        while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

                        textNodes.forEach(node => {
                            if (node.parentElement?.dataset.type === 'variable') {
                                // Migration: If inline style exists, remove it and add class
                                const p = node.parentElement;
                                if (p && (p.style.backgroundColor || p.style.border)) {
                                    p.removeAttribute('style');
                                    p.classList.add('contract-variable');
                                }
                                // Ensure class is present
                                if (p && !p.classList.contains('contract-variable')) {
                                    p.classList.add('contract-variable');
                                }
                                return;
                            }

                            let content = node.textContent || '';
                            let changed = false;
                            const fragment = document.createDocumentFragment();

                            // We need to split content by ALL keys.
                            // Simplification: Replace keys one by one?
                            // Issue: Text node splitting.

                            // Lets try the "Cleanup" approach. It's much simpler.
                            // 1. Do string replace (Global).
                            // 2. Parse DOM.
                            // 3. Find nested variable spans (`span[data-type="variable"] span[data-type="variable"]`).
                            // 4. Unwrap them.
                        });

                        // Let's implement the cleanup approach.
                        template.formSchema.forEach(field => {
                            if (field.type === 'section') return;
                            const placeholder = `{{${field.key}}}`;
                            const spanHTML = `<span class="contract-variable" data-type="variable" data-var-type="${field.type}" data-key="${field.key}" data-label="${field.label}">{{${field.label}}}</span>`;
                            const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                            processedHTML = processedHTML.replace(regex, spanHTML);
                        });

                        // Cleanup Nested Spans
                        const cleanupDiv = document.createElement('div');
                        cleanupDiv.innerHTML = processedHTML;
                        const nested = cleanupDiv.querySelectorAll('span[data-type="variable"] span[data-type="variable"]');
                        nested.forEach(inner => {
                            // The inner span was created by string replace inside an existing span.
                            // The existing span (outer) holds the correct style (from DB).
                            // The inner span holds the default style.
                            // We want to keep Outer style, but Inner content (which is {{Label}}).
                            // So replace Outer content with Inner content, but discard Inner tag.
                            const outer = inner.parentElement;
                            if (outer) {
                                outer.innerHTML = inner.innerHTML; // Keep text
                            }
                        });

                        return cleanupDiv.innerHTML;
                    });

                    setPages(processedPages);
                    setCurrentPageIndex(0);

                    // Explicitly sync to editor immediately after loading
                    if (editorRef.current && processedPages[0]) {
                        editorRef.current.innerHTML = processedPages[0];
                    }

                    // Initialize History with loaded content
                    setHistory([processedPages[0]]);
                    setHistoryIndex(0);
                }
            });
        }
    }, [templateId]);

    // --- History Management ---
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoRef = useRef(false); // Flag to prevent history push during undo/redo

    // Push to history
    const addToHistory = (content: string | undefined = undefined) => {
        if (!editorRef.current) return;
        const newContent = content !== undefined ? content : editorRef.current.innerHTML;

        // If same as current head, ignore
        if (historyIndex >= 0 && history[historyIndex] === newContent) return;

        const newHistory = [...history.slice(0, historyIndex + 1), newContent];
        if (newHistory.length > 50) newHistory.shift();

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            isUndoRef.current = true;
            const prevContent = history[historyIndex - 1];
            if (editorRef.current) editorRef.current.innerHTML = prevContent;
            setHistoryIndex(historyIndex - 1);
            // Sync with pages state
            setPages(prev => {
                const newPages = [...prev];
                newPages[currentPageIndex] = prevContent;
                return newPages;
            });
            setTimeout(() => isUndoRef.current = false, 0);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            isUndoRef.current = true;
            const nextContent = history[historyIndex + 1];
            if (editorRef.current) editorRef.current.innerHTML = nextContent;
            setHistoryIndex(historyIndex + 1);
            // Sync with pages state
            setPages(prev => {
                const newPages = [...prev];
                newPages[currentPageIndex] = nextContent;
                return newPages;
            });
            setTimeout(() => isUndoRef.current = false, 0);
        }
    };

    // Auto-save content to state on blur or interval could be good, but for now we rely on explicit actions
    // Let's add a blur listener to save content
    const handleBlur = () => {
        saveCurrentPageContent();
    };

    // Reset History on Page Change
    const isFirstMount = useRef(true);

    useEffect(() => {
        // If we are loading a template, skip the initial history reset 
        // because the template loader (useEffect[templateId]) will handle it with correct content.
        // This prevents the default "empty" page from being pushed to history.
        if (templateId && isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        isFirstMount.current = false;

        setHistory([]);
        setHistoryIndex(-1);
        if (pages[currentPageIndex]) {
            setHistory([pages[currentPageIndex]]);
            setHistoryIndex(0);
        }
    }, [currentPageIndex]);

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

            // Check format (Font Size, Line Height, Margin Bottom)
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                let node = selection.anchorNode;
                // Default values matching your toolbar defaults
                let fontSize = '11pt';
                let lineHeight = '1.6';
                let marginBottom = '5px';
                let fontSizeFound = false;

                // Traverse up to find styles
                while (node && node !== editorRef.current) {
                    if (node.nodeType === 1) {
                        const el = node as HTMLElement;

                        // Font Size Detection (Available via Computed Style)
                        if (!fontSizeFound) {
                            const computed = window.getComputedStyle(el);
                            if (computed.fontSize) {
                                const px = parseFloat(computed.fontSize);
                                if (!isNaN(px)) {
                                    // 1pt = 1.3333px => px * 0.75
                                    const pt = Math.round(px * 0.75);
                                    fontSize = `${pt}pt`;
                                    fontSizeFound = true;
                                }
                            }
                        }

                        // Prioritize the closest style definition for others
                        if (el.style.lineHeight && lineHeight === '1.6') lineHeight = el.style.lineHeight;
                        if (el.style.marginBottom && marginBottom === '5px') marginBottom = el.style.marginBottom;
                    }
                    node = node.parentElement;
                }

                setCurrentFontSize(fontSize);
                setCurrentLineHeight(lineHeight);
                setCurrentParagraphSpacing(marginBottom);
            }
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

    const applyHangingIndent = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        let node = selection.anchorNode;
        // Traverse up to find block element
        while (node && node !== editorRef.current) {
            if (node.nodeType === 1) { // Element
                const el = node as HTMLElement;
                const tag = el.tagName;
                if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'LI'].includes(tag)) {
                    // Check if already hanging (check for any negative text indent)
                    if (el.style.textIndent && el.style.textIndent.startsWith('-')) {
                        el.style.textIndent = '';
                        el.style.paddingLeft = '';
                        el.style.marginLeft = ''; // Clear margin if any
                    } else {
                        // Apply Hanging Indent (adjusted to 21px for better alignment with "N. ")
                        el.style.textIndent = '-21px';
                        el.style.paddingLeft = '21px';
                    }
                    return;
                }
            }
            node = node.parentElement;
        }
    };

    const changeFontSize = (size: string) => {
        // Snapshot before custom action if there are unsaved changes (e.g. typing)
        if (editorRef.current && historyIndex >= 0 && editorRef.current.innerHTML !== history[historyIndex]) {
            addToHistory();
        } else {
            // Force snapshot current state before modification if strictly equal to history head?
            // Actually, if we are at history head, and we modify, we lose that state if we don't ensure it's saved as "Previous".
            // Logic in addToHistory handles "if same content return".
            // We need to ensure we have a "Base" state.
            // If historyIndex points to "Base", and we modify "Base", we need to push "Base" (if not already?) No.
            // We need to push "New". Undo goes to "Base". Correct.
            // BUT if we typed something, "Base" is old.
            // The "if (innerHTML !== history)" check handles typing.
        }

        // Use execCommand to wrap selection in <font size="7"> (temporary marker)
        // Instead of replacing the node (which breaks native Undo), we modify the attributes.
        // Keeping the same DOM node helps the browser's Undo Manager track changes.

        document.execCommand('fontSize', false, '7');

        // Find the newly created font elements
        const fontElements = editorRef.current?.querySelectorAll('font[size="7"]');
        if (fontElements) {
            fontElements.forEach(font => {
                // Remove the size attribute and apply CSS style directly
                font.removeAttribute('size');
                (font as HTMLElement).style.fontSize = size;
            });
        }

        setCurrentFontSize(size);
        addToHistory(); // Save new state
        editorRef.current?.focus();
    };

    const applyBlockStyle = (styleProp: keyof CSSStyleDeclaration, value: string) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);

        const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE'];

        // Helper: closest block
        const getClosestBlock = (node: Node | null): HTMLElement | null => {
            while (node && node !== editorRef.current) {
                if (node.nodeType === 1 && blockTags.includes((node as HTMLElement).tagName)) {
                    return node as HTMLElement;
                }
                node = node.parentElement;
            }
            return null;
        };

        // Snapshot before custom action if there are unsaved changes (e.g. typing)
        if (editorRef.current && historyIndex >= 0 && editorRef.current.innerHTML !== history[historyIndex]) {
            addToHistory();
        }

        const startBlock = getClosestBlock(range.startContainer);
        const endBlock = getClosestBlock(range.endContainer);

        // Case 1: Single Block (collapsed or within same block)
        if (startBlock && startBlock === endBlock) {
            startBlock.style[styleProp as any] = value;
        }
        // Case 2: Multi-block selection
        else {
            const commonAncestor = range.commonAncestorContainer;
            const root = commonAncestor.nodeType === 1 ? commonAncestor : commonAncestor.parentElement;

            if (root) {
                const walker = document.createTreeWalker(
                    root,
                    NodeFilter.SHOW_ELEMENT,
                    {
                        acceptNode: (node) => {
                            if (blockTags.includes((node as HTMLElement).tagName)) {
                                if (range.intersectsNode(node)) {
                                    return NodeFilter.FILTER_ACCEPT;
                                }
                            }
                            return NodeFilter.FILTER_SKIP;
                        }
                    }
                );

                while (walker.nextNode()) {
                    // FIX: Cast to HTMLElement to solve lint error
                    (walker.currentNode as HTMLElement).style[styleProp as any] = value;
                }

                // Ensure start/end blocks are covered if TreeWalker missed them (e.g. if they are ancestors of root or boundary cases)
                if (startBlock && range.intersectsNode(startBlock)) startBlock.style[styleProp as any] = value;
                if (endBlock && range.intersectsNode(endBlock)) endBlock.style[styleProp as any] = value;
            }
        }

        // Snapshot after action
        addToHistory();
        editorRef.current?.focus();
    };

    const changeLineHeight = (value: string) => applyBlockStyle('lineHeight', value);
    const changeParagraphSpacing = (value: string) => applyBlockStyle('marginBottom', value);

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
                    <tr><td style="border: 1px solid #ddd; padding: 4px;">&nbsp;</td><td style="border: 1px solid #ddd; padding: 4px;">&nbsp;</td></tr>
                    <tr><td style="border: 1px solid #ddd; padding: 4px;">&nbsp;</td><td style="border: 1px solid #ddd; padding: 4px;">&nbsp;</td></tr>
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

    // --- Table Resizing Logic ---
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const handleMouseMove = (e: MouseEvent) => {
            const state = resizingState.current;

            // 1. Resizing in progress
            if (state.isResizing && state.targetCell) {
                const diff = e.clientX - state.startX;
                const newWidth = Math.max(20, state.startWidth + diff); // Minimum width 20px
                state.targetCell.style.width = `${newWidth}px`;
                e.preventDefault();
                return;
            }

            // 2. Detect hover on cell border (Right edge)
            const target = e.target as HTMLElement;
            if (target.tagName === 'TD' || target.tagName === 'TH') {
                const rect = target.getBoundingClientRect();
                const isOnRightEdge = e.clientX > rect.right - 5 && e.clientX < rect.right + 5;

                if (isOnRightEdge) {
                    target.style.cursor = 'col-resize';
                } else {
                    target.style.cursor = 'text';
                }
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if ((target.tagName === 'TD' || target.tagName === 'TH') && target.style.cursor === 'col-resize') {
                e.preventDefault();
                const rect = target.getBoundingClientRect();
                resizingState.current = {
                    isResizing: true,
                    startX: e.clientX,
                    startWidth: rect.width,
                    targetCell: target as HTMLTableCellElement
                };

                // Add resizing overlay or styles if needed
                document.body.style.cursor = 'col-resize';
            }
        };

        const handleMouseUp = () => {
            if (resizingState.current.isResizing) {
                resizingState.current = {
                    isResizing: false,
                    startX: 0,
                    startWidth: 0,
                    targetCell: null
                };
                document.body.style.cursor = 'default';
            }
        };

        editor.addEventListener('mousemove', handleMouseMove);
        editor.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            editor.removeEventListener('mousemove', handleMouseMove);
            editor.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // --- Image Resizing Logic ---
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        // Click to select image
        const handleEditorClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
                setSelectedImage(target as HTMLImageElement);
            } else {
                setSelectedImage(null);
            }
        };

        editor.addEventListener('click', handleEditorClick);
        return () => editor.removeEventListener('click', handleEditorClick);
    }, []);

    // Global Mouse Handling for Image Resize
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (imgResizingState.current.isResizing && imgResizingState.current.targetImg) {
                const state = imgResizingState.current;
                const diffX = e.clientX - state.startX;

                // Maintain aspect ratio or just width? Let's scale uniformly based on width change
                const newWidth = Math.max(50, state.startWidth + diffX);
                const ratio = state.startHeight / state.startWidth;

                if (state.targetImg) {
                    state.targetImg.style.width = `${newWidth}px`;
                    state.targetImg.style.height = `${newWidth * ratio}px`;
                }
                e.preventDefault();
            }
        };

        const handleMouseUp = () => {
            if (imgResizingState.current.isResizing) {
                imgResizingState.current = { ...imgResizingState.current, isResizing: false, targetImg: null };
                document.body.style.cursor = 'default';
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const startImageResize = (e: React.MouseEvent) => {
        if (!selectedImage) return;
        e.preventDefault();
        e.stopPropagation(); // Prevent deselecting

        imgResizingState.current = {
            isResizing: true,
            startX: e.clientX,
            startWidth: selectedImage.clientWidth,
            startHeight: selectedImage.clientHeight,
            targetImg: selectedImage
        };
        document.body.style.cursor = 'nwse-resize';
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
        span.className = 'contract-variable';
        // Removed inline styles to use usage-based CSS (Visible in Builder, Invisible in Print/View)
        // span.style.backgroundColor = '#e7f5ff';
        // span.style.color = '#1971c2';
        // span.style.padding = '2px 6px';
        // span.style.borderRadius = '4px';
        // span.style.border = '1px solid #a5d8ff';
        span.style.margin = '0 2px';
        // span.style.fontSize = '0.9em'; // Removed
        span.style.fontWeight = '500';
        span.style.display = 'inline'; // Changed from inline-block to inline for better formatting support
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
        addToHistory();
        editorRef.current?.focus();
    };

    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleInput = () => {
        if (isUndoRef.current) return;

        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

        debounceTimeout.current = setTimeout(() => {
            addToHistory();
        }, 1000); // 1-second debounce for typing
    };

    // --- Page Overflow Protection & Undo/Redo ---
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!editorRef.current) return;

        // Custom Undo/Redo
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                return;
            }
            if (e.key === 'y') {
                e.preventDefault();
                redo();
                return;
            }
        }

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

    // --- Variable Selection UX ---
    // Single click: Select all text in variable
    // Second click (already active): Default behavior (place cursor, drag select)
    const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target && target.classList.contains('contract-variable')) {
            const selection = window.getSelection();
            if (!selection) return;

            // Check if user is ALREADY interacting with this variable (cursor inside or selection inside)
            let isAlreadyInside = false;
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                // Check if anchor (start of selection press) is inside target
                // We use anchorNode because it represents where the user WAS before this new click? 
                // Actually, getSelection() returns current state.
                // If user clicks from outside, anchorNode is outside.
                // If user clicks inside (while already inside), anchorNode is inside.

                isAlreadyInside = target.contains(selection.anchorNode) ||
                    target === selection.anchorNode ||
                    (selection.anchorNode?.nodeType === Node.TEXT_NODE && target.contains(selection.anchorNode.parentElement));
            }

            if (!isAlreadyInside) {
                // User is entering from outside -> Force Select All
                e.preventDefault(); // Prevent caret placement
                const newRange = document.createRange();
                newRange.selectNodeContents(target);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
            // If already inside: Do nothing. Allow browser default (move caret, start drag selection, etc.)
        }
    };

    // --- Save ---
    const handleSave = async () => {
        const supabase = createClient();

        // First save current content
        if (editorRef.current) {
            pages[currentPageIndex] = editorRef.current.innerHTML;
        }

        if (!title.trim()) {
            alert('템플릿 제목을 입력해주세요.');
            return;
        }

        setIsSaving(true);

        // Join pages
        const fullContent = pages.join(PAGE_DELIMITER);
        const schema: FormField[] = [];

        const parser = new DOMParser();
        const doc = parser.parseFromString(fullContent, 'text/html');
        const varNodes = doc.querySelectorAll('span[data-type="variable"]');
        varNodes.forEach((node: any) => {
            const visibleText = node.innerText.replace(/{{|}}/g, '').trim();
            if (!visibleText) return; // Skip empty vars

            const newLabel = visibleText;
            const newKey = newLabel.replace(/\s+/g, '_');
            const type = node.dataset.varType || 'text';

            schema.push({
                key: newKey,
                label: newLabel,
                type: type as any,
                placeholder: newLabel + ' 을(를) 입력하세요'
            });
        });

        const storageHTML = doc.body.innerHTML;

        try {
            // Priority: Save to Cloud (DB)
            let currentId = editingTemplateId;
            const isCustom = currentId && currentId.startsWith('usr-t-');
            const method = (!currentId || isCustom) ? 'POST' : 'PUT';
            const url = method === 'PUT' ? `/api/templates/${currentId}` : '/api/templates';

            const payload = {
                id: currentId, // Explicitly send ID (API will fallback to generated if null)
                name: title,
                category,
                formSchema: schema,
                htmlTemplate: storageHTML,
                description: '사용자 정의 템플릿'
            };

            // Get session for Authorization header
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const cloudRes = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(payload)
            });

            if (cloudRes.ok) {
                const cloudData = await cloudRes.json();
                if (method === 'POST') {
                    currentId = cloudData.id;
                    setEditingTemplateId(currentId);
                }
            } else {
                const errData = await cloudRes.json();
                console.error('Cloud save failed:', errData);
                throw new Error(errData.error || 'Server responded with an error');
            }

            // Also keep LocalStorage as backup/legacy support
            const existingStr = localStorage.getItem('custom_templates');
            const existing: ContractTemplate[] = existingStr ? JSON.parse(existingStr) : [];

            if (currentId && currentId.startsWith('usr-t-')) {
                const index = existing.findIndex(t => t.id === currentId);
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
                        id: currentId,
                        name: title,
                        category,
                        formSchema: schema,
                        htmlTemplate: storageHTML,
                        description: '사용자 정의 템플릿'
                    });
                }
                localStorage.setItem('custom_templates', JSON.stringify(existing));
            }

            alert('템플릿이 저장되었습니다! (클라우드 동기화 완료)');

            if (projectId && returnToProject) {
                router.push('/contracts/project/' + projectId + '?newDoc=' + currentId);
            } else {
                router.push('/contracts');
            }
        } catch (e) {
            console.error('Save failed:', e);
            alert('저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={styles.container} className="builder-container">

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
                    <button
                        onClick={handleSave}
                        style={{ ...styles.saveBtn, opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                        disabled={isSaving}
                    >
                        <Save size={16} /> {isSaving ? '저장 중...' : '템플릿 저장'}
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

                    {/* Font Size Selector */}
                    <select
                        style={{ ...styles.select, width: '70px', height: '30px', padding: '0 4px' }}
                        value={currentFontSize}
                        onChange={(e) => changeFontSize(e.target.value)}
                        title="글자 크기"
                    >
                        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72].map(size => (
                            <option key={size} value={size + 'pt'}>{size}pt</option>
                        ))}
                    </select>

                    <div style={styles.separator} />

                    {/* Line Height Selector */}
                    <select
                        style={{ ...styles.select, width: '70px', height: '30px', padding: '0 4px' }}
                        onChange={(e) => changeLineHeight(e.target.value)}
                        value={currentLineHeight}
                        title="줄 간격"
                    >
                        <option value="1.0">1.0</option>
                        <option value="1.15">1.15</option>
                        <option value="1.3">1.3</option>
                        <option value="1.4">1.4</option>
                        <option value="1.5">1.5</option>
                        <option value="1.6">1.6 (기본)</option>
                        <option value="1.8">1.8</option>
                        <option value="2.0">2.0</option>
                        <option value="2.5">2.5</option>
                        <option value="3.0">3.0</option>
                    </select>

                    {/* Paragraph Spacing Selector */}
                    <select
                        style={{ ...styles.select, width: '80px', height: '30px', padding: '0 4px' }}
                        onChange={(e) => changeParagraphSpacing(e.target.value)}
                        value={currentParagraphSpacing}
                        title="문단 간격 (엔터키 공백)"
                    >
                        <option value="0px">0px</option>
                        <option value="2px">2px</option>
                        <option value="5px">5px (기본)</option>
                        <option value="8px">8px</option>
                        <option value="10px">10px</option>
                        <option value="15px">15px</option>
                        <option value="20px">20px</option>
                        <option value="30px">30px</option>
                    </select>

                    <div style={styles.separator} />

                    <button onClick={() => execCmd('justifyLeft')} title="왼쪽" style={{ ...styles.toolBtn, backgroundColor: activeFormats.justifyLeft ? '#e9ecef' : 'transparent' }}><AlignLeft size={18} /></button>
                    <button onClick={() => execCmd('justifyCenter')} title="가운데" style={{ ...styles.toolBtn, backgroundColor: activeFormats.justifyCenter ? '#e9ecef' : 'transparent' }}><AlignCenter size={18} /></button>
                    <button onClick={() => execCmd('justifyRight')} title="오른쪽" style={{ ...styles.toolBtn, backgroundColor: activeFormats.justifyRight ? '#e9ecef' : 'transparent' }}><AlignRight size={18} /></button>

                    <button onClick={() => execCmd('outdent')} title="내어쓰기 (Shift+Tab)" style={styles.toolBtn}><OutdentIcon size={18} /></button>
                    <button onClick={() => execCmd('indent')} title="들여쓰기 (Tab)" style={styles.toolBtn}><IndentIcon size={18} /></button>
                    <button onClick={applyHangingIndent} title="첫 줄 내어쓰기 (나머지 들여쓰기)" style={styles.toolBtn}><WrapText size={18} /></button>

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
                    {/* Pagination Controls (Pill Shape) */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px',
                        backgroundColor: 'white', padding: '10px 20px', borderRadius: '30px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #dee2e6',
                        zIndex: 10
                    }}>
                        <button
                            onClick={goPrevPage}
                            disabled={currentPageIndex === 0}
                            style={{
                                border: 'none', background: 'none', cursor: currentPageIndex === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', color: currentPageIndex === 0 ? '#adb5bd' : '#228be6'
                            }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span style={{ fontWeight: 600, fontSize: '15px', minWidth: '60px', textAlign: 'center' }}>
                            {currentPageIndex + 1} / {pages.length}
                        </span>
                        <button
                            onClick={goNextPage}
                            disabled={currentPageIndex === pages.length - 1}
                            style={{
                                border: 'none', background: 'none', cursor: currentPageIndex === pages.length - 1 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', color: currentPageIndex === pages.length - 1 ? '#adb5bd' : '#228be6'
                            }}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Wrapped Paper & Overlay for Positioning */}
                    <div style={{ position: 'relative' }}>
                        {/* Current Page Content */}
                        <div
                            ref={editorRef}
                            contentEditable
                            onInput={handleInput}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            onMouseDown={handleEditorMouseDown}
                            style={styles.paper}
                            className="contract-preview cv-builder-mode"
                            spellCheck={false}
                        />

                        {/* Page Number Overlay in Builder */}
                        <div style={{
                            position: 'absolute',
                            bottom: '5mm',
                            left: 0,
                            right: 0,
                            textAlign: 'center',
                            fontSize: '12px',
                            color: '#868e96',
                            pointerEvents: 'none'
                        }}>
                            - {currentPageIndex + 1} -
                        </div>
                    </div>


                    {/* Image Resize Overlay */}
                    {selectedImage && (
                        <div style={{
                            position: 'absolute',
                            top: selectedImage.offsetTop,
                            left: selectedImage.offsetLeft,
                            width: selectedImage.clientWidth,
                            height: selectedImage.clientHeight,
                            border: '2px solid #007bff',
                            pointerEvents: 'none', // Allow clicking through to image? No, overlay is on top.
                            zIndex: 100
                        }}>
                            {/* Resize Handle (Bottom Right) */}
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: '-6px',
                                    right: '-6px',
                                    width: '12px',
                                    height: '12px',
                                    backgroundColor: '#007bff',
                                    borderRadius: '50%',
                                    cursor: 'nwse-resize',
                                    pointerEvents: 'auto'
                                }}
                                onMouseDown={startImageResize}
                            />
                        </div>
                    )}

                    {/* Page Info Loop */}
                    <div style={styles.pageInfo}>
                        {currentPageIndex + 1} / {pages.length} 페이지
                    </div>
                </div>
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
        padding: '5mm 10mm',
        letterSpacing: '-0.5px',
        wordSpacing: '-1px',
        boxSizing: 'border-box' as const,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        position: 'relative' as const,
        outline: 'none',
        fontSize: '16px',
        lineHeight: '1.6',
        color: '#212529',
        overflow: 'hidden', // Enforce A4 constraint
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

export default function TemplateBuilderPage() {
    return (
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>로딩 중...</div>}>
            <BuilderContent />
        </Suspense>
    );
}

