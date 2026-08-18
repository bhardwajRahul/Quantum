let geoip: any = null;

const loadGeoip = (): any => {
    if(geoip === null){

        geoip = require('geoip-lite');
    }
    return geoip;
};

export const lookupCountry = (ip: string): string | null => {
    if(!ip) return null;

    let clean = ip.trim();
    const lastColon = clean.lastIndexOf(':');
    if(lastColon !== -1 && clean.indexOf(':') === lastColon){
        clean = clean.slice(0, lastColon);
    }
    if(!clean) return null;
    try{
        const result = loadGeoip().lookup(clean);
        const country = result?.country;
        return country ? String(country).toUpperCase().slice(0, 2) : null;
    }catch{
        return null;
    }
};

export default { lookupCountry };
