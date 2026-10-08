import { useEffect, useState } from 'react';

/** 글자를 입력하지 않는 input 종류 (눌러도 화면 키보드가 올라오지 않는다) */
const NOT_TEXT = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

const isTextField = (el: Element | null) =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !NOT_TEXT.has(el.type)) ||
  (el instanceof HTMLElement && el.isContentEditable);

/**
 * 휴대폰에서 글자를 입력하는 중인지 (입력칸에 커서가 있어 화면 키보드가 올라와 있음).
 * 마우스를 쓰는 기기는 키보드가 화면을 가리지 않아서 늘 false
 */
export function useTyping() {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    // focusout 때는 아직 다음 칸으로 옮겨 가기 전이라 한 틱 뒤에 확인한다
    let timer = 0;
    const update = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setTyping(isTextField(document.activeElement)), 0);
    };
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  return typing;
}
