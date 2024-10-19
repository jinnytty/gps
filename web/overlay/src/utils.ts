import { Config, GpsConfig } from './index';

export function parseParams(param: URLSearchParams): Config {
  const get = (name: string) => {
    for (const [key, value] of param.entries()) {
      if (key.toLowerCase() === name.toLocaleLowerCase()) {
        return value;
      }
    }
    return null;
  };
  const num = (name: string, def: number) => {
    const v = get(name);
    if (v === null) return def;
    try {
      return Number(v);
    } catch (e) {
      return def;
    }
  };
  const num0 = (name: string) => {
    const v = get(name);
    if (v === null) return undefined;
    try {
      return Number(v);
    } catch (e) {
      return undefined;
    }
  };
  const str = (name: string, def: string) => {
    console.log('get str', name, def, get(name));
    const v = get(name);
    if (v === null) return def;
    return v;
  };
  const str0 = (name: string) => {
    const v = get(name);
    if (v === null) return undefined;
    return v;
  };

  const ids: string[] = [];
  param.forEach((v, p) => {
    let key: string | null = null;

    if (p.startsWith('key_')) {
      key = p.substring(4);
    }
    if (p === 'key') {
      key = '';
    }
    console.log('search', p, key);
    if (key !== null && ids.indexOf(key) === -1) {
      ids.push(key);
    }
  });
  console.log('ids', ids);
  const gps: GpsConfig[] = [];
  ids.forEach((k) => {
    const postfix = k.length > 0 ? `_${k}` : '';
    const gpsc: GpsConfig = {
      key: str('key' + postfix, ''),
      accessToken: str('accessToken' + postfix, ''),
      color: str('color' + postfix, 'eb384a'),
      icon: str0('icon' + postfix),
      iconWidth: num0('iconWidth' + postfix),
      iconHeight: num0('iconHeight' + postfix),
      iconAnchorX: num0('iconAnchorX' + postfix),
      iconAnchorY: num0('iconAnchorY' + postfix),
      zIndex: num0('zIndex' + postfix),
    };
    gps.push(gpsc);
  });

  const config: Config = {
    lat: num('lat', 0),
    lng: num('lng', 0),
    zoom: num('zoom', 12),
    tile: str0('tile'),
    gps,
  };

  return config;
}
