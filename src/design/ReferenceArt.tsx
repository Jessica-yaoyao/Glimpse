import observer from './assets/observer.png';
import cat from './assets/cat.png';
import dog from './assets/flying-dog.png';

import walking from './vectors/reference-walking.svg';
import chooser from './vectors/reference-chooser.svg';
import welcome from './vectors/reference-welcome.svg';

// Original reference crops. These decorations never sit on top of the user's photo.
export function ReferenceArt({ kind, className = '' }: { kind: 'observer' | 'cat' | 'dog' | 'walking' | 'chooser' | 'welcome'; className?: string }) {
  return <img className={`reference-art ${className}`} src={{ observer, cat, dog, walking, chooser, welcome }[kind]} alt="" aria-hidden="true" draggable={false} />;
}
