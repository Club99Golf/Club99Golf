import { useRef } from "react";
import { Source, Layer } from "react-map-gl";
import { mkId, geoJSONCircle } from "../../utils/mapMath";

export default function MapCircle({ center, radiusYards, strokeColor, fillColor, fillOpacity, strokeWeight }) {
  const id = useRef(mkId("mcirc")).current;
  if (!center || !radiusYards) return null;
  const data = geoJSONCircle(center, radiusYards);
  return (
    <Source id={id} type="geojson" data={data}>
      <Layer id={`${id}-fill`} type="fill" paint={{ "fill-color": fillColor || strokeColor || "#C0C0C0", "fill-opacity": fillOpacity ?? 0 }} />
      <Layer id={`${id}-line`} type="line" paint={{ "line-color": strokeColor || "#C0C0C0", "line-opacity": 0.85, "line-width": strokeWeight ?? 2 }} />
    </Source>
  );
}

// COURSE_DB is imported from ./courses.js
