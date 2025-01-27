export function replaceAccents(origin) {
    return origin.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

export function humanToKebab(humanStr) {
    return replaceAccents(humanStr).trim().toLowerCase().split(" ")
        .map((word) => word
            .replace(/[^a-zA-Z0-9-]/g, '')
            .replace(/[ñ]/g, 'n')
            .replace(/[Ñ]/g, 'N')
        ).join("-");
};

export function camelToHuman(camelStr) {
    const words = camelStr.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
    let humanStr = words.shift().toLowerCase();
    humanStr = humanStr.charAt(0).toUpperCase() + humanStr.slice(1);
    for (const word of words) {
        humanStr += ` ${word.toLowerCase()}`;
    }
    return humanStr;
};