'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, Undo, Redo,
} from 'lucide-react';

interface RichTextEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({
  initialContent = '',
  onChange,
  placeholder = '请输入内容...',
  minHeight = 300,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const tools = [
    { icon: Bold, command: 'bold', title: '加粗' },
    { icon: Italic, command: 'italic', title: '斜体' },
    { icon: Underline, command: 'underline', title: '下划线' },
    { icon: Strikethrough, command: 'strikeThrough', title: '删除线' },
    { icon: AlignLeft, command: 'justifyLeft', title: '左对齐' },
    { icon: AlignCenter, command: 'justifyCenter', title: '居中' },
    { icon: AlignRight, command: 'justifyRight', title: '右对齐' },
    { icon: List, command: 'insertUnorderedList', title: '无序列表' },
    { icon: ListOrdered, command: 'insertOrderedList', title: '有序列表' },
    { icon: Undo, command: 'undo', title: '撤销' },
    { icon: Redo, command: 'redo', title: '重做' },
  ];

  return (
    <div className={`border rounded-lg overflow-hidden ${isFocused ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-center gap-0.5 p-1 bg-gray-50 border-b flex-wrap">
        {tools.map(({ icon: Icon, command, title }) => (
          <Button
            key={command}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => execCommand(command)}
            title={title}
            type="button"
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="p-3 outline-none prose max-w-none"
        style={{ minHeight: `${minHeight}px` }}
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        dangerouslySetInnerHTML={{ __html: initialContent }}
        data-placeholder={placeholder}
      />
    </div>
  );
}
