import { splitLinks } from '@/react/lib/links';

const links = (text: string) => splitLinks(text).filter((p) => p.href);

describe('splitLinks', () => {
  it('plain text stays one piece, and joining the pieces always gives the text back', () => {
    expect(splitLinks('ترنيمة بسيطة')).toEqual([{ text: 'ترنيمة بسيطة' }]);
    expect(splitLinks('')).toEqual([]);
    const text = 'اسمع https://youtu.be/abc?t=5 وبعدين www.example.com/x.\nوبعدها (https://a.org/q)';
    expect(splitLinks(text).map((p) => p.text).join('')).toBe(text);
  });

  it('finds http and https links, and gives www. links an https address', () => {
    expect(links('a http://a.org/x b')).toEqual([{ text: 'http://a.org/x', href: 'http://a.org/x' }]);
    expect(links('b https://b.org/y?z=1&w=2#h')).toEqual([{ text: 'https://b.org/y?z=1&w=2#h', href: 'https://b.org/y?z=1&w=2#h' }]);
    expect(links('www.c.org/p')).toEqual([{ text: 'www.c.org/p', href: 'https://www.c.org/p' }]);
  });

  it('finds several links, also between Arabic words and on several lines', () => {
    const found = links('الترنيمة https://a.org/1،والدرس\nhttps://b.org/2 شكرا');
    expect(found.map((p) => p.href)).toEqual(['https://a.org/1', 'https://b.org/2']);
  });

  it('a full stop, comma or closing bracket after a link is not part of it', () => {
    expect(links('شوف https://a.org/x.')[0]!.text).toBe('https://a.org/x');
    expect(links('(https://a.org/x), وبعدين')[0]!.text).toBe('https://a.org/x');
    expect(links('هو https://a.org/x؟')[0]!.text).toBe('https://a.org/x');
    expect(links('https://en.wikipedia.org/wiki/Foo_(bar)')[0]!.text).toBe('https://en.wikipedia.org/wiki/Foo_(bar)'); // its own brackets stay
  });

  it('only web addresses become links: other schemes and half links stay text', () => {
    expect(links('javascript:alert(1) و ftp://a.org و mailto:a@b.org و https://')).toEqual([]);
    expect(links('اكتب www. بس')).toEqual([]);
  });
});
