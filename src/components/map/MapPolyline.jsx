import { useRef } from "react";
import { Source, Layer } from "react-map-gl";
import { mkId } from "../../utils/mapMath";

export default function MapPolyline({ path, strokeColor, strokeWeight, strokeOpacity, lineBlur }) {
  const id = useRef(mkId("mpl")).current;
  if (!path || path.length < 2) return null;
  const data = { type: "Feature", geometry: { type: "LineString", coordinates: path.map(p => [p.lng, p.lat]) } };
  return (
    <Source id={id} type="geojson" data={data}>
      <Layer id={`${id}-l`} type="line" paint={{ "line-color": strokeColor || "#fff", "line-opacity": strokeOpacity ?? 0.9, "line-width": strokeWeight ?? 2, "line-blur": lineBlur || 0 }} layout={{ "line-cap": "round", "line-join": "round" }} />
    </Source>
  );
}

// Renders a geographic circle — must be rendered inside react-map-gl <Map>
