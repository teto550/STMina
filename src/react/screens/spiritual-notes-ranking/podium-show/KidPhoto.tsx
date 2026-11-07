import { useEffect, useState, type FC } from 'react';
import { faceOf } from '../podium';

type KidPhotoProps = {
  /** the name shown next to it (the accessible name of the picture) */
  name: string;
  /** the kid's photo; '' = none */
  photo: string;
  /** which cartoon face to draw when there is no photo (or it does not load) */
  face: number;
  /** width and height in pixels */
  size: number;
};

/** A round picture of a kid: his photo from the card, or a cartoon kid on a coloured background (a different one for each kid of the show). */
export const KidPhoto: FC<KidPhotoProps> = ({ name, photo, face, size }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [photo]);
  const real = !!photo && !failed;
  const look = faceOf(face);
  return (
    <span
      role="img"
      aria-label={name}
      className="tw:box-border tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-full tw:border-4 tw:border-white tw:shadow-xl"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.58), background: real ? '#fff' : `linear-gradient(135deg, ${look.from}, ${look.to})` }}
    >
      {real ? <img src={photo} alt="" className="tw:size-full tw:object-cover" onError={() => setFailed(true)} /> : <span aria-hidden="true">{look.emoji}</span>}
    </span>
  );
};
