import { mountIsland, unmountIsland } from '@/react/mount';
import { act } from 'react';

describe('mountIsland', () => {
  it('renders into an element of the page and cleans up on unmount', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => { mountIsland(el, <p>hello from react</p>); });
    expect(el).toHaveTextContent('hello from react');
    expect(el).toHaveClass('rx-root');
    await act(async () => { unmountIsland(el); });
    expect(el).toBeEmptyDOMElement();
    expect(el).not.toHaveClass('rx-root');
    el.remove();
  });

  it('leaves the rest of the page alone', async () => {
    document.body.innerHTML = '<div id="old">old screen</div><div id="new"></div>';
    await act(async () => { mountIsland(document.getElementById('new')!, <p>new screen</p>); });
    expect(document.getElementById('old')).toHaveTextContent('old screen');
    expect(document.getElementById('new')).toHaveTextContent('new screen');
  });
});
