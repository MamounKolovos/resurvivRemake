function min(a: number, b: number) {
    return a < b ? a : b;
}

function max(a: number, b: number) {
    return a > b ? a : b;
}

export interface Vec2 {
    x: number
    y: number
}

export const v2 = {
    create(x: number, y?: number) {
        return { x, y: y ?? x };
    },

    copy(vec: Vec2) {
        return { x: vec.x, y: vec.y };
    },

    set(a: Vec2, b: Vec2) {
        a.x = b.x;
        a.y = b.y;
    },

    add(a: Vec2, b: Vec2) {
        return { x: a.x + b.x, y: a.y + b.y };
    },

    sub(a: Vec2, b: Vec2) {
        return { x: a.x - b.x, y: a.y - b.y };
    },

    mul(a: Vec2, s: number) {
        return { x: a.x * s, y: a.y * s };
    },

    div(a: Vec2, s: number) {
        return { x: a.x / s, y: a.y / s };
    },

    neg(a: Vec2) {
        return { x: -a.x, y: -a.y };
    },

    lengthSqr(a: Vec2) {
        return a.x * a.x + a.y * a.y;
    },

    length(a: Vec2) {
        return Math.sqrt(v2.lengthSqr(a));
    },

    normalize(a: Vec2) {
        const eps = 0.000001;
        const len = v2.length(a);
        return {
            x: len > eps ? a.x / len : a.x,
            y: len > eps ? a.y / len : a.y
        };
    },

    distance(startPos: Vec2, finishPos: Vec2) {
        const diffPos = v2.sub(startPos, finishPos);
        return v2.length(diffPos);
    },

    directionNormalized(a: Vec2, b: Vec2) {
        const diffPos = v2.sub(b, a);
        return v2.normalize(diffPos);
    },

    normalizeSafe(a: Vec2, v = v2.create(1.0, 0.0)) {
        const eps = 0.000001;
        const len = v2.length(a);
        return {
            x: len > eps ? a.x / len : v.x,
            y: len > eps ? a.y / len : v.y
        };
    },

    dot(a: Vec2, b: Vec2) {
        return a.x * b.x + a.y * b.y;
    },

    perp(a: Vec2): Vec2 {
        return { x: -a.y, y: a.x };
    },

    proj(a: Vec2, b: Vec2) {
        return v2.mul(b, v2.dot(a, b) / v2.dot(b, b));
    },

    rotate(a: Vec2, rad: number) {
        const cosr = Math.cos(rad);
        const sinr = Math.sin(rad);
        return {
            x: a.x * cosr - a.y * sinr,
            y: a.x * sinr + a.y * cosr
        };
    },

    mulElems(a: Vec2, b: Vec2) {
        return { x: a.x * b.x, y: a.y * b.y };
    },

    divElems(a: Vec2, b: Vec2) {
        return { x: a.x / b.x, y: a.y / b.y };
    },

    minElems(a: Vec2, b: Vec2) {
        return { x: min(a.x, b.x), y: min(a.y, b.y) };
    },

    maxElems(a: Vec2, b: Vec2) {
        return { x: max(a.x, b.x), y: max(a.y, b.y) };
    },

    randomUnit() {
        return v2.normalizeSafe(v2.create(Math.random() - 0.5, Math.random() - 0.5), v2.create(1.0, 0.0));
    },

    lerp(t: number, a: Vec2, b: Vec2) {
        return v2.add(v2.mul(a, 1.0 - t), v2.mul(b, t));
    },

    eq(a: Vec2, b: Vec2, epsilon = 0.0001) {
        return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
    }
};
