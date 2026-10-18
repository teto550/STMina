import { render, screen } from '@testing-library/react';
import { LinkifiedText } from '@/react/components/ui/linkified-text';

describe('LinkifiedText', () => {
  it('shows plain text as text, with no link', () => {
    render(<LinkifiedText text="ترنيمة الدخول" />);
    expect(screen.getByText('ترنيمة الدخول')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('turns every web link into a link that opens in a new tab, safely, and keeps the text around it', () => {
    render(<LinkifiedText text={'اسمع الترنيمة: https://youtu.be/abc.\nوالكلمات: www.example.com/words'} />);
    const [first, second] = screen.getAllByRole('link');
    expect(first).toHaveAttribute('href', 'https://youtu.be/abc');
    expect(first).toHaveTextContent('https://youtu.be/abc');
    expect(first).toHaveAttribute('target', '_blank');
    expect(first).toHaveAttribute('rel', 'noopener noreferrer');
    expect(first).toHaveAttribute('dir', 'ltr'); // an address inside Arabic text is read left to right
    expect(second).toHaveAttribute('href', 'https://www.example.com/words');
    expect(screen.getByText(/اسمع الترنيمة/)).toHaveTextContent('اسمع الترنيمة: https://youtu.be/abc. والكلمات: www.example.com/words');
  });

  it('keeps the line breaks of the text', () => {
    render(<LinkifiedText text={'سطر\nسطر'} />);
    expect(screen.getByText(/سطر/).className).toContain('tw:whitespace-pre-line');
  });
});
