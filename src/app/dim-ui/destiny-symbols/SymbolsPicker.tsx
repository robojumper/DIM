import { tempContainer } from 'app/utils/temp-container';
import { useContext, useRef, useState } from 'react';

import _ from 'lodash';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';
import { PressTipRoot } from '../PressTip';
import { usePopper } from '../usePopper';
import { symbolsSelector } from './destiny-symbols';

import { SearchInput } from 'app/search/SearchInput';
import ColorDestinySymbols from './ColorDestinySymbols';
import styles from './SymbolsPicker.m.scss';

export default function SymbolsPicker<T extends HTMLTextAreaElement | HTMLInputElement>({
  input,
  setValue,
  insertionIndex,
  setInsertionIndex,
}: {
  input: React.RefObject<T>;
  setValue: (val: string) => void;
  insertionIndex: number | null;
  setInsertionIndex: (val: number) => void;
}) {
  const controlRef = useRef<HTMLDivElement>(null);
  const tooltipContents = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pressTipRoot = useContext(PressTipRoot);

  const makePopup = () => (
    <SymbolsWindow
      onChooseGlyph={(symbol) => {
        if (input.current) {
          const inputText = input.current.value;
          const insIndex = insertionIndex ?? inputText.length;
          setValue(inputText.slice(0, insIndex) + symbol + inputText.slice(insIndex));
          setInsertionIndex(insIndex + symbol.length);
        }
      }}
    />
  );

  usePopper({
    contents: tooltipContents,
    reference: controlRef,
    arrowClassName: '',
    placement: 'auto',
  });

  return (
    <div ref={controlRef}>
      <button
        type="button"
        className={styles.symbolsButton}
        onClick={() => setOpen(!open)}
        title="Open Symbols Picker"
      >
        <span></span>
      </button>
      {open &&
        ReactDOM.createPortal(
          <div style={{ zIndex: 15 }} ref={tooltipContents}>
            {_.isFunction(makePopup) ? makePopup() : makePopup}
          </div>,
          pressTipRoot.current || tempContainer
        )}
    </div>
  );
}

function SymbolsWindow({ onChooseGlyph }: { onChooseGlyph: (unicode: string) => void }) {
  const allSymbols = useSelector(symbolsSelector);
  const emojis = Object.values(allSymbols).map(({ glyph, name, fullName }) => ({
    id: name,
    name: fullName,
    keyword: name,
    glyph,
  }));
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<typeof emojis[number] | undefined>(undefined);
  return (
    <>
      <div className={styles.symbolsWindow}>
        <div className={styles.symbolsSearch}>
          <SearchInput query={query} onQueryChanged={setQuery} placeholder="Search emoji..." />
        </div>
        <div className={styles.symbolsBody}>
          <div className={styles.symbolsContainer}>
            {emojis
              .filter((e) => e.keyword.includes(query) || e.name.includes(query))
              .map((emoji) => (
                <button
                  className={styles.emojiButton}
                  type="button"
                  key={emoji.glyph}
                  onClick={() => onChooseGlyph(emoji.glyph)}
                  onMouseOver={() => setPreview(emoji)}
                >
                  {emoji.glyph}
                </button>
              ))}
          </div>
        </div>
        <div className={styles.symbolsFooter}>
          <ColorDestinySymbols text={preview?.glyph ?? ''} />
          {preview && (
            <div>
              <span>{preview.name}</span>
              <span>:{preview.keyword}:</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
