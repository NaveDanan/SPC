import React, { useEffect, useMemo, useRef } from 'react';
import { markdownToHtml, tryRenderMathIn } from '../../utils/markdown';

interface MarkdownTextProps {
  text: string;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ text }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const html = useMemo(() => markdownToHtml(text), [text]);

  useEffect(() => {
    if (!containerRef.current) return;
    tryRenderMathIn(containerRef.current);
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="markdown-body"
      // The HTML is produced from a safe-to-HTML conversion that escapes content by default.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownText;

