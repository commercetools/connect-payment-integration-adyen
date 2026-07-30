import Header from './components/Header.tsx';
import ExpressPdpSection from './components/checkout/ExpressPdpSection.tsx';

export default function ExpressApp() {
  return (
    <>
      <Header active="Express" />
      <div className="cs-page">
        <ExpressPdpSection />
      </div>
    </>
  );
}
