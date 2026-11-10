import { BrandMark } from "./brand";

export function VoiceObject() {
  return (
    <div className="voice-object" aria-hidden="true">
      <div className="voice-object__track" />
      <div className="voice-object__body">
        <BrandMark size={72} />
      </div>
      <div className="voice-object__signal">
        {[5, 13, 24, 36, 24, 13, 5].map((height, index) => <i key={index} style={{ height }} />)}
      </div>
    </div>
  );
}
