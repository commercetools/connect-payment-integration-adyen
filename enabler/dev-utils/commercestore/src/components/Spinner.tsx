interface SpinnerProps {
  text?: string;
}

export default function Spinner({ text = 'Loading...' }: SpinnerProps) {
  return (
    <div className="cs-spinner-wrap">
      <div className="cs-spinner" />
      <p className="cs-spinner-text">{text}</p>
    </div>
  );
}
