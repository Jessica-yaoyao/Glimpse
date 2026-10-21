export function Icon({ name, size = 20 }: { name: 'arrow' | 'back' | 'plus' | 'spark' | 'crop' | 'reset' | 'check' | 'home' | 'journal' | 'map' | 'search'; size?: number }) {
  const paths = {
    search: 'M17 17 22 22M19 10a8.1 8.1 0 1 1-16.2 0 8.1 8.1 0 0 1 16.2 0',
    arrow: 'M3.8 12.4 19.6 12m-6.2-6.2 6.2 6.2-6.5 6.2', back: 'M15.7 3.2 6.7 12l9.4 8.7',
    plus: 'm12.3 4.6-.4 15M4.6 12.4l15-.4', spark: 'm12 2.8 3 6.1 6.8.8-5.1 4.7 1.5 6.5-6.2-3.3-6 3.4 1.4-6.8-5-4.3 6.6-1L12 2.8Z',
    crop: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    reset: 'M4 10a8 8 0 1 1 1 7M4 4v6h6', check: 'm5 12 4 4L19 6',
    home: 'm2.5 10.7 9.6-8.3 9.4 8.5-2.1-.2.1 10-5.1-.1.1-7.1-5.1.1.1 7-5-.2.2-10.1-2.2.4Z',
    journal: 'M7.2 3.7 17 3.4q2.6.1 2.8 3l-.2 13q-.1 2-2.7 1.9l-10.4.1q-2.1-.2-2-2.9L4.6 6q.1-2.3 2.6-2.3ZM8.4 2v4.3M15.9 2.3v4M8.1 11.2l7.5-.2M8.2 15.8l4.8.2',
    map: 'M12 22s-7.3-8.5-7.1-13q.1-7 7.1-7t7.2 7C19.1 13.5 12 22 12 22ZM15.1 9a3.1 3.1 0 1 1-6.2.1A3.1 3.1 0 0 1 15.1 9Z',
  };
  return <svg className={`hand-icon icon-${name}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
