import observer from './assets/observer.png';
import cat from './assets/cat.png';
import dog from './assets/flying-dog.png';

// Original reference crops. These decorations never sit on top of the user's photo.
export function ReferenceArt({ kind, className = '' }: { kind: 'observer' | 'cat' | 'dog'; className?: string }) {
  return <img className={`reference-art ${className}`} src={{ observer, cat, dog }[kind]} alt="" aria-hidden="true" draggable={false} />;
}
