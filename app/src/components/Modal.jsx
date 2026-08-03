import { useEffect, useRef, useState } from 'react';

export default function Modal({ titulo, onClose, children, ancho = '500px' }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const hasDragged  = useRef(false);
  const startPos    = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function onPointerDown(e) {
    if (e.target.closest('.modal-close')) return;
    isDragging.current = true;
    hasDragged.current = false;
    startPos.current    = { x: e.clientX, y: e.clientY };
    startOffset.current = { x: offset.x,  y: offset.y  };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
    setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy });
  }

  function onPointerUp() {
    isDragging.current      = false;
    document.body.style.cursor = '';
  }

  function handleOverlayClick(e) {
    if (hasDragged.current) { hasDragged.current = false; return; }
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-box"
        style={{ maxWidth: ancho, position: 'relative', left: offset.x, top: offset.y }}
      >
        <div
          className="modal-header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ cursor: 'grab', userSelect: 'none' }}
        >
          <h2 className="modal-title">{titulo}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
