export const formatBytes = (n) => {
    const v = Number(n);
    if(!v || v < 0 || Number.isNaN(v)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(v) / Math.log(1024)), units.length - 1);
    return `${(v / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};
