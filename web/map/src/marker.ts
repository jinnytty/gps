import { MapMarker } from '@jinnytty-gps/api-model';
import { Map } from 'leaflet';
import * as L from 'leaflet';

export function addMarker(map: Map, m: MapMarker) {
  const opt: L.MarkerOptions = {
    zIndexOffset: 900,
  };
  if (m.icon) {
    const icon = L.icon({
      iconUrl: m.icon.url,
      iconSize: [m.icon.width, m.icon.height],
      iconAnchor: [m.icon.anchorX, m.icon.anchorY],
    });
    opt.icon = icon;
    const innerIcon = m.innerIcon;
    let innerSource = '';
    if (innerIcon) {
      innerSource = `<img 
       style="position:absolute;z-index:-1;width:${innerIcon.width}px;height:${innerIcon.height}px;left:${innerIcon.anchorX}px;top:${innerIcon.anchorY}px" 
       src="${innerIcon.url}" />`;
    }
    console.log('innerSource', innerSource);
    const cls = m.bounce ? 'class="bounce"' : '';
    const customIcon = L.divIcon({
      html: `<div ${cls}>
        ${innerSource}
        <img src="${m.icon.url}" 
             style="width:${m.icon.width}px;height:${m.icon.height}px;" />
      </div>`,
      iconSize: [m.icon.width, m.icon.height], // Size of the icon
      iconAnchor: [m.icon.anchorX, m.icon.anchorY], // Anchor point of the icon
    });
    opt.icon = customIcon;
  }
  const marker = L.marker([m.lat, m.lng], opt).addTo(map);
  console.log('marker', marker);
}
