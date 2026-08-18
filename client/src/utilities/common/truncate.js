export const truncate = (text, max = 120) => {
    if(!text) return '';
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
