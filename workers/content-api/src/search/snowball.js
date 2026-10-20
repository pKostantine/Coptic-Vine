// Snowball 2.2.0 stemmers for English, French, Arabic and Greek: the version
// PostgreSQL 17 embeds (src/backend/snowball/README: commit 48a67a28, tag
// v2.2.0), so a word stems here exactly as Supabase stems it. Generated, not
// written: built the Snowball compiler at v2.2.0 and ran
//   ./snowball algorithms/<language>.sbl -js -o <language>-stemmer
// then joined javascript/base-stemmer.js and the four outputs below. Licence:
// BSD 3-clause, see SNOWBALL-LICENSE. Do not edit by hand.
/* eslint-disable */
let BaseStemmer, JsEnglishStemmer, JsFrenchStemmer, JsArabicStemmer, JsGreekStemmer;
/**@constructor*/
BaseStemmer = function() {
    this.setCurrent = function(value) {
        this.current = value;
        this.cursor = 0;
        this.limit = this.current.length;
        this.limit_backward = 0;
        this.bra = this.cursor;
        this.ket = this.limit;
    };

    this.getCurrent = function() {
        return this.current;
    };

    this.copy_from = function(other) {
        this.current          = other.current;
        this.cursor           = other.cursor;
        this.limit            = other.limit;
        this.limit_backward   = other.limit_backward;
        this.bra              = other.bra;
        this.ket              = other.ket;
    };

    this.in_grouping = function(s, min, max) {
        if (this.cursor >= this.limit) return false;
        var ch = this.current.charCodeAt(this.cursor);
        if (ch > max || ch < min) return false;
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) == 0) return false;
        this.cursor++;
        return true;
    };

    this.in_grouping_b = function(s, min, max) {
        if (this.cursor <= this.limit_backward) return false;
        var ch = this.current.charCodeAt(this.cursor - 1);
        if (ch > max || ch < min) return false;
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) == 0) return false;
        this.cursor--;
        return true;
    };

    this.out_grouping = function(s, min, max) {
        if (this.cursor >= this.limit) return false;
        var ch = this.current.charCodeAt(this.cursor);
        if (ch > max || ch < min) {
            this.cursor++;
            return true;
        }
        ch -= min;
        if ((s[ch >>> 3] & (0X1 << (ch & 0x7))) == 0) {
            this.cursor++;
            return true;
        }
        return false;
    };

    this.out_grouping_b = function(s, min, max) {
        if (this.cursor <= this.limit_backward) return false;
        var ch = this.current.charCodeAt(this.cursor - 1);
        if (ch > max || ch < min) {
            this.cursor--;
            return true;
        }
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) == 0) {
            this.cursor--;
            return true;
        }
        return false;
    };

    this.eq_s = function(s)
    {
        if (this.limit - this.cursor < s.length) return false;
        if (this.current.slice(this.cursor, this.cursor + s.length) != s)
        {
            return false;
        }
        this.cursor += s.length;
        return true;
    };

    this.eq_s_b = function(s)
    {
        if (this.cursor - this.limit_backward < s.length) return false;
        if (this.current.slice(this.cursor - s.length, this.cursor) != s)
        {
            return false;
        }
        this.cursor -= s.length;
        return true;
    };

    /** @return {number} */ this.find_among = function(v)
    {
        var i = 0;
        var j = v.length;

        var c = this.cursor;
        var l = this.limit;

        var common_i = 0;
        var common_j = 0;

        var first_key_inspected = false;

        while (true)
        {
            var k = i + ((j - i) >>> 1);
            var diff = 0;
            var common = common_i < common_j ? common_i : common_j; // smaller
            // w[0]: string, w[1]: substring_i, w[2]: result, w[3]: function (optional)
            var w = v[k];
            var i2;
            for (i2 = common; i2 < w[0].length; i2++)
            {
                if (c + common == l)
                {
                    diff = -1;
                    break;
                }
                diff = this.current.charCodeAt(c + common) - w[0].charCodeAt(i2);
                if (diff != 0) break;
                common++;
            }
            if (diff < 0)
            {
                j = k;
                common_j = common;
            }
            else
            {
                i = k;
                common_i = common;
            }
            if (j - i <= 1)
            {
                if (i > 0) break; // v->s has been inspected
                if (j == i) break; // only one item in v

                // - but now we need to go round once more to get
                // v->s inspected. This looks messy, but is actually
                // the optimal approach.

                if (first_key_inspected) break;
                first_key_inspected = true;
            }
        }
        do {
            var w = v[i];
            if (common_i >= w[0].length)
            {
                this.cursor = c + w[0].length;
                if (w.length < 4) return w[2];
                var res = w[3](this);
                this.cursor = c + w[0].length;
                if (res) return w[2];
            }
            i = w[1];
        } while (i >= 0);
        return 0;
    };

    // find_among_b is for backwards processing. Same comments apply
    this.find_among_b = function(v)
    {
        var i = 0;
        var j = v.length

        var c = this.cursor;
        var lb = this.limit_backward;

        var common_i = 0;
        var common_j = 0;

        var first_key_inspected = false;

        while (true)
        {
            var k = i + ((j - i) >> 1);
            var diff = 0;
            var common = common_i < common_j ? common_i : common_j;
            var w = v[k];
            var i2;
            for (i2 = w[0].length - 1 - common; i2 >= 0; i2--)
            {
                if (c - common == lb)
                {
                    diff = -1;
                    break;
                }
                diff = this.current.charCodeAt(c - 1 - common) - w[0].charCodeAt(i2);
                if (diff != 0) break;
                common++;
            }
            if (diff < 0)
            {
                j = k;
                common_j = common;
            }
            else
            {
                i = k;
                common_i = common;
            }
            if (j - i <= 1)
            {
                if (i > 0) break;
                if (j == i) break;
                if (first_key_inspected) break;
                first_key_inspected = true;
            }
        }
        do {
            var w = v[i];
            if (common_i >= w[0].length)
            {
                this.cursor = c - w[0].length;
                if (w.length < 4) return w[2];
                var res = w[3](this);
                this.cursor = c - w[0].length;
                if (res) return w[2];
            }
            i = w[1];
        } while (i >= 0);
        return 0;
    };

    /* to replace chars between c_bra and c_ket in this.current by the
     * chars in s.
     */
    this.replace_s = function(c_bra, c_ket, s)
    {
        var adjustment = s.length - (c_ket - c_bra);
        this.current = this.current.slice(0, c_bra) + s + this.current.slice(c_ket);
        this.limit += adjustment;
        if (this.cursor >= c_ket) this.cursor += adjustment;
        else if (this.cursor > c_bra) this.cursor = c_bra;
        return adjustment;
    };

    this.slice_check = function()
    {
        if (this.bra < 0 ||
            this.bra > this.ket ||
            this.ket > this.limit ||
            this.limit > this.current.length)
        {
            return false;
        }
        return true;
    };

    this.slice_from = function(s)
    {
        var result = false;
        if (this.slice_check())
        {
            this.replace_s(this.bra, this.ket, s);
            result = true;
        }
        return result;
    };

    this.slice_del = function()
    {
        return this.slice_from("");
    };

    this.insert = function(c_bra, c_ket, s)
    {
        var adjustment = this.replace_s(c_bra, c_ket, s);
        if (c_bra <= this.bra) this.bra += adjustment;
        if (c_bra <= this.ket) this.ket += adjustment;
    };

    this.slice_to = function()
    {
        var result = '';
        if (this.slice_check())
        {
            result = this.current.slice(this.bra, this.ket);
        }
        return result;
    };

    this.assign_to = function()
    {
        return this.current.slice(0, this.limit);
    };
};

// Generated by Snowball 2.2.0 - https://snowballstem.org/

/**@constructor*/
JsEnglishStemmer = function() {
    var base = new BaseStemmer();
    /** @const */ var a_0 = [
        ["arsen", -1, -1],
        ["commun", -1, -1],
        ["gener", -1, -1]
    ];

    /** @const */ var a_1 = [
        ["'", -1, 1],
        ["'s'", 0, 1],
        ["'s", -1, 1]
    ];

    /** @const */ var a_2 = [
        ["ied", -1, 2],
        ["s", -1, 3],
        ["ies", 1, 2],
        ["sses", 1, 1],
        ["ss", 1, -1],
        ["us", 1, -1]
    ];

    /** @const */ var a_3 = [
        ["", -1, 3],
        ["bb", 0, 2],
        ["dd", 0, 2],
        ["ff", 0, 2],
        ["gg", 0, 2],
        ["bl", 0, 1],
        ["mm", 0, 2],
        ["nn", 0, 2],
        ["pp", 0, 2],
        ["rr", 0, 2],
        ["at", 0, 1],
        ["tt", 0, 2],
        ["iz", 0, 1]
    ];

    /** @const */ var a_4 = [
        ["ed", -1, 2],
        ["eed", 0, 1],
        ["ing", -1, 2],
        ["edly", -1, 2],
        ["eedly", 3, 1],
        ["ingly", -1, 2]
    ];

    /** @const */ var a_5 = [
        ["anci", -1, 3],
        ["enci", -1, 2],
        ["ogi", -1, 13],
        ["li", -1, 15],
        ["bli", 3, 12],
        ["abli", 4, 4],
        ["alli", 3, 8],
        ["fulli", 3, 9],
        ["lessli", 3, 14],
        ["ousli", 3, 10],
        ["entli", 3, 5],
        ["aliti", -1, 8],
        ["biliti", -1, 12],
        ["iviti", -1, 11],
        ["tional", -1, 1],
        ["ational", 14, 7],
        ["alism", -1, 8],
        ["ation", -1, 7],
        ["ization", 17, 6],
        ["izer", -1, 6],
        ["ator", -1, 7],
        ["iveness", -1, 11],
        ["fulness", -1, 9],
        ["ousness", -1, 10]
    ];

    /** @const */ var a_6 = [
        ["icate", -1, 4],
        ["ative", -1, 6],
        ["alize", -1, 3],
        ["iciti", -1, 4],
        ["ical", -1, 4],
        ["tional", -1, 1],
        ["ational", 5, 2],
        ["ful", -1, 5],
        ["ness", -1, 5]
    ];

    /** @const */ var a_7 = [
        ["ic", -1, 1],
        ["ance", -1, 1],
        ["ence", -1, 1],
        ["able", -1, 1],
        ["ible", -1, 1],
        ["ate", -1, 1],
        ["ive", -1, 1],
        ["ize", -1, 1],
        ["iti", -1, 1],
        ["al", -1, 1],
        ["ism", -1, 1],
        ["ion", -1, 2],
        ["er", -1, 1],
        ["ous", -1, 1],
        ["ant", -1, 1],
        ["ent", -1, 1],
        ["ment", 15, 1],
        ["ement", 16, 1]
    ];

    /** @const */ var a_8 = [
        ["e", -1, 1],
        ["l", -1, 2]
    ];

    /** @const */ var a_9 = [
        ["succeed", -1, -1],
        ["proceed", -1, -1],
        ["exceed", -1, -1],
        ["canning", -1, -1],
        ["inning", -1, -1],
        ["earring", -1, -1],
        ["herring", -1, -1],
        ["outing", -1, -1]
    ];

    /** @const */ var a_10 = [
        ["andes", -1, -1],
        ["atlas", -1, -1],
        ["bias", -1, -1],
        ["cosmos", -1, -1],
        ["dying", -1, 3],
        ["early", -1, 9],
        ["gently", -1, 7],
        ["howe", -1, -1],
        ["idly", -1, 6],
        ["lying", -1, 4],
        ["news", -1, -1],
        ["only", -1, 10],
        ["singly", -1, 11],
        ["skies", -1, 2],
        ["skis", -1, 1],
        ["sky", -1, -1],
        ["tying", -1, 5],
        ["ugly", -1, 8]
    ];

    /** @const */ var /** Array<int> */ g_v = [17, 65, 16, 1];

    /** @const */ var /** Array<int> */ g_v_WXY = [1, 17, 65, 208, 1];

    /** @const */ var /** Array<int> */ g_valid_LI = [55, 141, 2];

    var /** boolean */ B_Y_found = false;
    var /** number */ I_p2 = 0;
    var /** number */ I_p1 = 0;


    /** @return {boolean} */
    function r_prelude() {
        B_Y_found = false;
        var /** number */ v_1 = base.cursor;
        lab0: {
            base.bra = base.cursor;
            if (!(base.eq_s("'")))
            {
                break lab0;
            }
            base.ket = base.cursor;
            if (!base.slice_del())
            {
                return false;
            }
        }
        base.cursor = v_1;
        var /** number */ v_2 = base.cursor;
        lab1: {
            base.bra = base.cursor;
            if (!(base.eq_s("y")))
            {
                break lab1;
            }
            base.ket = base.cursor;
            if (!base.slice_from("Y"))
            {
                return false;
            }
            B_Y_found = true;
        }
        base.cursor = v_2;
        var /** number */ v_3 = base.cursor;
        lab2: {
            while(true)
            {
                var /** number */ v_4 = base.cursor;
                lab3: {
                    golab4: while(true)
                    {
                        var /** number */ v_5 = base.cursor;
                        lab5: {
                            if (!(base.in_grouping(g_v, 97, 121)))
                            {
                                break lab5;
                            }
                            base.bra = base.cursor;
                            if (!(base.eq_s("y")))
                            {
                                break lab5;
                            }
                            base.ket = base.cursor;
                            base.cursor = v_5;
                            break golab4;
                        }
                        base.cursor = v_5;
                        if (base.cursor >= base.limit)
                        {
                            break lab3;
                        }
                        base.cursor++;
                    }
                    if (!base.slice_from("Y"))
                    {
                        return false;
                    }
                    B_Y_found = true;
                    continue;
                }
                base.cursor = v_4;
                break;
            }
        }
        base.cursor = v_3;
        return true;
    };

    /** @return {boolean} */
    function r_mark_regions() {
        I_p1 = base.limit;
        I_p2 = base.limit;
        var /** number */ v_1 = base.cursor;
        lab0: {
            lab1: {
                var /** number */ v_2 = base.cursor;
                lab2: {
                    if (base.find_among(a_0) == 0)
                    {
                        break lab2;
                    }
                    break lab1;
                }
                base.cursor = v_2;
                golab3: while(true)
                {
                    lab4: {
                        if (!(base.in_grouping(g_v, 97, 121)))
                        {
                            break lab4;
                        }
                        break golab3;
                    }
                    if (base.cursor >= base.limit)
                    {
                        break lab0;
                    }
                    base.cursor++;
                }
                golab5: while(true)
                {
                    lab6: {
                        if (!(base.out_grouping(g_v, 97, 121)))
                        {
                            break lab6;
                        }
                        break golab5;
                    }
                    if (base.cursor >= base.limit)
                    {
                        break lab0;
                    }
                    base.cursor++;
                }
            }
            I_p1 = base.cursor;
            golab7: while(true)
            {
                lab8: {
                    if (!(base.in_grouping(g_v, 97, 121)))
                    {
                        break lab8;
                    }
                    break golab7;
                }
                if (base.cursor >= base.limit)
                {
                    break lab0;
                }
                base.cursor++;
            }
            golab9: while(true)
            {
                lab10: {
                    if (!(base.out_grouping(g_v, 97, 121)))
                    {
                        break lab10;
                    }
                    break golab9;
                }
                if (base.cursor >= base.limit)
                {
                    break lab0;
                }
                base.cursor++;
            }
            I_p2 = base.cursor;
        }
        base.cursor = v_1;
        return true;
    };

    /** @return {boolean} */
    function r_shortv() {
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                if (!(base.out_grouping_b(g_v_WXY, 89, 121)))
                {
                    break lab1;
                }
                if (!(base.in_grouping_b(g_v, 97, 121)))
                {
                    break lab1;
                }
                if (!(base.out_grouping_b(g_v, 97, 121)))
                {
                    break lab1;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            if (!(base.out_grouping_b(g_v, 97, 121)))
            {
                return false;
            }
            if (!(base.in_grouping_b(g_v, 97, 121)))
            {
                return false;
            }
            if (base.cursor > base.limit_backward)
            {
                return false;
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_R1() {
        if (!(I_p1 <= base.cursor))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_R2() {
        if (!(I_p2 <= base.cursor))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Step_1a() {
        var /** number */ among_var;
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            base.ket = base.cursor;
            if (base.find_among_b(a_1) == 0)
            {
                base.cursor = base.limit - v_1;
                break lab0;
            }
            base.bra = base.cursor;
            if (!base.slice_del())
            {
                return false;
            }
        }
        base.ket = base.cursor;
        among_var = base.find_among_b(a_2);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!base.slice_from("ss"))
                {
                    return false;
                }
                break;
            case 2:
                lab1: {
                    var /** number */ v_2 = base.limit - base.cursor;
                    lab2: {
                        {
                            var /** number */ c1 = base.cursor - 2;
                            if (c1 < base.limit_backward)
                            {
                                break lab2;
                            }
                            base.cursor = c1;
                        }
                        if (!base.slice_from("i"))
                        {
                            return false;
                        }
                        break lab1;
                    }
                    base.cursor = base.limit - v_2;
                    if (!base.slice_from("ie"))
                    {
                        return false;
                    }
                }
                break;
            case 3:
                if (base.cursor <= base.limit_backward)
                {
                    return false;
                }
                base.cursor--;
                golab3: while(true)
                {
                    lab4: {
                        if (!(base.in_grouping_b(g_v, 97, 121)))
                        {
                            break lab4;
                        }
                        break golab3;
                    }
                    if (base.cursor <= base.limit_backward)
                    {
                        return false;
                    }
                    base.cursor--;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Step_1b() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_4);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!r_R1())
                {
                    return false;
                }
                if (!base.slice_from("ee"))
                {
                    return false;
                }
                break;
            case 2:
                var /** number */ v_1 = base.limit - base.cursor;
                golab0: while(true)
                {
                    lab1: {
                        if (!(base.in_grouping_b(g_v, 97, 121)))
                        {
                            break lab1;
                        }
                        break golab0;
                    }
                    if (base.cursor <= base.limit_backward)
                    {
                        return false;
                    }
                    base.cursor--;
                }
                base.cursor = base.limit - v_1;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_3 = base.limit - base.cursor;
                among_var = base.find_among_b(a_3);
                if (among_var == 0)
                {
                    return false;
                }
                base.cursor = base.limit - v_3;
                switch (among_var) {
                    case 1:
                        {
                            var /** number */ c1 = base.cursor;
                            base.insert(base.cursor, base.cursor, "e");
                            base.cursor = c1;
                        }
                        break;
                    case 2:
                        base.ket = base.cursor;
                        if (base.cursor <= base.limit_backward)
                        {
                            return false;
                        }
                        base.cursor--;
                        base.bra = base.cursor;
                        if (!base.slice_del())
                        {
                            return false;
                        }
                        break;
                    case 3:
                        if (base.cursor != I_p1)
                        {
                            return false;
                        }
                        var /** number */ v_4 = base.limit - base.cursor;
                        if (!r_shortv())
                        {
                            return false;
                        }
                        base.cursor = base.limit - v_4;
                        {
                            var /** number */ c2 = base.cursor;
                            base.insert(base.cursor, base.cursor, "e");
                            base.cursor = c2;
                        }
                        break;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Step_1c() {
        base.ket = base.cursor;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                if (!(base.eq_s_b("y")))
                {
                    break lab1;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            if (!(base.eq_s_b("Y")))
            {
                return false;
            }
        }
        base.bra = base.cursor;
        if (!(base.out_grouping_b(g_v, 97, 121)))
        {
            return false;
        }
        lab2: {
            if (base.cursor > base.limit_backward)
            {
                break lab2;
            }
            return false;
        }
        if (!base.slice_from("i"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Step_2() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_5);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!r_R1())
        {
            return false;
        }
        switch (among_var) {
            case 1:
                if (!base.slice_from("tion"))
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("ence"))
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_from("ance"))
                {
                    return false;
                }
                break;
            case 4:
                if (!base.slice_from("able"))
                {
                    return false;
                }
                break;
            case 5:
                if (!base.slice_from("ent"))
                {
                    return false;
                }
                break;
            case 6:
                if (!base.slice_from("ize"))
                {
                    return false;
                }
                break;
            case 7:
                if (!base.slice_from("ate"))
                {
                    return false;
                }
                break;
            case 8:
                if (!base.slice_from("al"))
                {
                    return false;
                }
                break;
            case 9:
                if (!base.slice_from("ful"))
                {
                    return false;
                }
                break;
            case 10:
                if (!base.slice_from("ous"))
                {
                    return false;
                }
                break;
            case 11:
                if (!base.slice_from("ive"))
                {
                    return false;
                }
                break;
            case 12:
                if (!base.slice_from("ble"))
                {
                    return false;
                }
                break;
            case 13:
                if (!(base.eq_s_b("l")))
                {
                    return false;
                }
                if (!base.slice_from("og"))
                {
                    return false;
                }
                break;
            case 14:
                if (!base.slice_from("less"))
                {
                    return false;
                }
                break;
            case 15:
                if (!(base.in_grouping_b(g_valid_LI, 99, 116)))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Step_3() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_6);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!r_R1())
        {
            return false;
        }
        switch (among_var) {
            case 1:
                if (!base.slice_from("tion"))
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("ate"))
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_from("al"))
                {
                    return false;
                }
                break;
            case 4:
                if (!base.slice_from("ic"))
                {
                    return false;
                }
                break;
            case 5:
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 6:
                if (!r_R2())
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Step_4() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_7);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!r_R2())
        {
            return false;
        }
        switch (among_var) {
            case 1:
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                lab0: {
                    var /** number */ v_1 = base.limit - base.cursor;
                    lab1: {
                        if (!(base.eq_s_b("s")))
                        {
                            break lab1;
                        }
                        break lab0;
                    }
                    base.cursor = base.limit - v_1;
                    if (!(base.eq_s_b("t")))
                    {
                        return false;
                    }
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Step_5() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_8);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                lab0: {
                    var /** number */ v_1 = base.limit - base.cursor;
                    lab1: {
                        if (!r_R2())
                        {
                            break lab1;
                        }
                        break lab0;
                    }
                    base.cursor = base.limit - v_1;
                    if (!r_R1())
                    {
                        return false;
                    }
                    {
                        var /** number */ v_2 = base.limit - base.cursor;
                        lab2: {
                            if (!r_shortv())
                            {
                                break lab2;
                            }
                            return false;
                        }
                        base.cursor = base.limit - v_2;
                    }
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!r_R2())
                {
                    return false;
                }
                if (!(base.eq_s_b("l")))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_exception2() {
        base.ket = base.cursor;
        if (base.find_among_b(a_9) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_exception1() {
        var /** number */ among_var;
        base.bra = base.cursor;
        among_var = base.find_among(a_10);
        if (among_var == 0)
        {
            return false;
        }
        base.ket = base.cursor;
        if (base.cursor < base.limit)
        {
            return false;
        }
        switch (among_var) {
            case 1:
                if (!base.slice_from("ski"))
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("sky"))
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_from("die"))
                {
                    return false;
                }
                break;
            case 4:
                if (!base.slice_from("lie"))
                {
                    return false;
                }
                break;
            case 5:
                if (!base.slice_from("tie"))
                {
                    return false;
                }
                break;
            case 6:
                if (!base.slice_from("idl"))
                {
                    return false;
                }
                break;
            case 7:
                if (!base.slice_from("gentl"))
                {
                    return false;
                }
                break;
            case 8:
                if (!base.slice_from("ugli"))
                {
                    return false;
                }
                break;
            case 9:
                if (!base.slice_from("earli"))
                {
                    return false;
                }
                break;
            case 10:
                if (!base.slice_from("onli"))
                {
                    return false;
                }
                break;
            case 11:
                if (!base.slice_from("singl"))
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_postlude() {
        if (!B_Y_found)
        {
            return false;
        }
        while(true)
        {
            var /** number */ v_1 = base.cursor;
            lab0: {
                golab1: while(true)
                {
                    var /** number */ v_2 = base.cursor;
                    lab2: {
                        base.bra = base.cursor;
                        if (!(base.eq_s("Y")))
                        {
                            break lab2;
                        }
                        base.ket = base.cursor;
                        base.cursor = v_2;
                        break golab1;
                    }
                    base.cursor = v_2;
                    if (base.cursor >= base.limit)
                    {
                        break lab0;
                    }
                    base.cursor++;
                }
                if (!base.slice_from("y"))
                {
                    return false;
                }
                continue;
            }
            base.cursor = v_1;
            break;
        }
        return true;
    };

    this.stem = /** @return {boolean} */ function() {
        lab0: {
            var /** number */ v_1 = base.cursor;
            lab1: {
                if (!r_exception1())
                {
                    break lab1;
                }
                break lab0;
            }
            base.cursor = v_1;
            lab2: {
                {
                    var /** number */ v_2 = base.cursor;
                    lab3: {
                        {
                            var /** number */ c1 = base.cursor + 3;
                            if (c1 > base.limit)
                            {
                                break lab3;
                            }
                            base.cursor = c1;
                        }
                        break lab2;
                    }
                    base.cursor = v_2;
                }
                break lab0;
            }
            base.cursor = v_1;
            r_prelude();
            r_mark_regions();
            base.limit_backward = base.cursor; base.cursor = base.limit;
            var /** number */ v_5 = base.limit - base.cursor;
            r_Step_1a();
            base.cursor = base.limit - v_5;
            lab4: {
                var /** number */ v_6 = base.limit - base.cursor;
                lab5: {
                    if (!r_exception2())
                    {
                        break lab5;
                    }
                    break lab4;
                }
                base.cursor = base.limit - v_6;
                var /** number */ v_7 = base.limit - base.cursor;
                r_Step_1b();
                base.cursor = base.limit - v_7;
                var /** number */ v_8 = base.limit - base.cursor;
                r_Step_1c();
                base.cursor = base.limit - v_8;
                var /** number */ v_9 = base.limit - base.cursor;
                r_Step_2();
                base.cursor = base.limit - v_9;
                var /** number */ v_10 = base.limit - base.cursor;
                r_Step_3();
                base.cursor = base.limit - v_10;
                var /** number */ v_11 = base.limit - base.cursor;
                r_Step_4();
                base.cursor = base.limit - v_11;
                var /** number */ v_12 = base.limit - base.cursor;
                r_Step_5();
                base.cursor = base.limit - v_12;
            }
            base.cursor = base.limit_backward;
            var /** number */ v_13 = base.cursor;
            r_postlude();
            base.cursor = v_13;
        }
        return true;
    };

    /**@return{string}*/
    this['stemWord'] = function(/**string*/word) {
        base.setCurrent(word);
        this.stem();
        return base.getCurrent();
    };
};

// Generated by Snowball 2.2.0 - https://snowballstem.org/

/**@constructor*/
JsFrenchStemmer = function() {
    var base = new BaseStemmer();
    /** @const */ var a_0 = [
        ["col", -1, -1],
        ["par", -1, -1],
        ["tap", -1, -1]
    ];

    /** @const */ var a_1 = [
        ["", -1, 7],
        ["H", 0, 6],
        ["He", 1, 4],
        ["Hi", 1, 5],
        ["I", 0, 1],
        ["U", 0, 2],
        ["Y", 0, 3]
    ];

    /** @const */ var a_2 = [
        ["iqU", -1, 3],
        ["abl", -1, 3],
        ["I\u00E8r", -1, 4],
        ["i\u00E8r", -1, 4],
        ["eus", -1, 2],
        ["iv", -1, 1]
    ];

    /** @const */ var a_3 = [
        ["ic", -1, 2],
        ["abil", -1, 1],
        ["iv", -1, 3]
    ];

    /** @const */ var a_4 = [
        ["iqUe", -1, 1],
        ["atrice", -1, 2],
        ["ance", -1, 1],
        ["ence", -1, 5],
        ["logie", -1, 3],
        ["able", -1, 1],
        ["isme", -1, 1],
        ["euse", -1, 11],
        ["iste", -1, 1],
        ["ive", -1, 8],
        ["if", -1, 8],
        ["usion", -1, 4],
        ["ation", -1, 2],
        ["ution", -1, 4],
        ["ateur", -1, 2],
        ["iqUes", -1, 1],
        ["atrices", -1, 2],
        ["ances", -1, 1],
        ["ences", -1, 5],
        ["logies", -1, 3],
        ["ables", -1, 1],
        ["ismes", -1, 1],
        ["euses", -1, 11],
        ["istes", -1, 1],
        ["ives", -1, 8],
        ["ifs", -1, 8],
        ["usions", -1, 4],
        ["ations", -1, 2],
        ["utions", -1, 4],
        ["ateurs", -1, 2],
        ["ments", -1, 15],
        ["ements", 30, 6],
        ["issements", 31, 12],
        ["it\u00E9s", -1, 7],
        ["ment", -1, 15],
        ["ement", 34, 6],
        ["issement", 35, 12],
        ["amment", 34, 13],
        ["emment", 34, 14],
        ["aux", -1, 10],
        ["eaux", 39, 9],
        ["eux", -1, 1],
        ["it\u00E9", -1, 7]
    ];

    /** @const */ var a_5 = [
        ["ira", -1, 1],
        ["ie", -1, 1],
        ["isse", -1, 1],
        ["issante", -1, 1],
        ["i", -1, 1],
        ["irai", 4, 1],
        ["ir", -1, 1],
        ["iras", -1, 1],
        ["ies", -1, 1],
        ["\u00EEmes", -1, 1],
        ["isses", -1, 1],
        ["issantes", -1, 1],
        ["\u00EEtes", -1, 1],
        ["is", -1, 1],
        ["irais", 13, 1],
        ["issais", 13, 1],
        ["irions", -1, 1],
        ["issions", -1, 1],
        ["irons", -1, 1],
        ["issons", -1, 1],
        ["issants", -1, 1],
        ["it", -1, 1],
        ["irait", 21, 1],
        ["issait", 21, 1],
        ["issant", -1, 1],
        ["iraIent", -1, 1],
        ["issaIent", -1, 1],
        ["irent", -1, 1],
        ["issent", -1, 1],
        ["iront", -1, 1],
        ["\u00EEt", -1, 1],
        ["iriez", -1, 1],
        ["issiez", -1, 1],
        ["irez", -1, 1],
        ["issez", -1, 1]
    ];

    /** @const */ var a_6 = [
        ["a", -1, 3],
        ["era", 0, 2],
        ["asse", -1, 3],
        ["ante", -1, 3],
        ["\u00E9e", -1, 2],
        ["ai", -1, 3],
        ["erai", 5, 2],
        ["er", -1, 2],
        ["as", -1, 3],
        ["eras", 8, 2],
        ["\u00E2mes", -1, 3],
        ["asses", -1, 3],
        ["antes", -1, 3],
        ["\u00E2tes", -1, 3],
        ["\u00E9es", -1, 2],
        ["ais", -1, 3],
        ["erais", 15, 2],
        ["ions", -1, 1],
        ["erions", 17, 2],
        ["assions", 17, 3],
        ["erons", -1, 2],
        ["ants", -1, 3],
        ["\u00E9s", -1, 2],
        ["ait", -1, 3],
        ["erait", 23, 2],
        ["ant", -1, 3],
        ["aIent", -1, 3],
        ["eraIent", 26, 2],
        ["\u00E8rent", -1, 2],
        ["assent", -1, 3],
        ["eront", -1, 2],
        ["\u00E2t", -1, 3],
        ["ez", -1, 2],
        ["iez", 32, 2],
        ["eriez", 33, 2],
        ["assiez", 33, 3],
        ["erez", 32, 2],
        ["\u00E9", -1, 2]
    ];

    /** @const */ var a_7 = [
        ["e", -1, 3],
        ["I\u00E8re", 0, 2],
        ["i\u00E8re", 0, 2],
        ["ion", -1, 1],
        ["Ier", -1, 2],
        ["ier", -1, 2]
    ];

    /** @const */ var a_8 = [
        ["ell", -1, -1],
        ["eill", -1, -1],
        ["enn", -1, -1],
        ["onn", -1, -1],
        ["ett", -1, -1]
    ];

    /** @const */ var /** Array<int> */ g_v = [17, 65, 16, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 130, 103, 8, 5];

    /** @const */ var /** Array<int> */ g_keep_with_s = [1, 65, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128];

    var /** number */ I_p2 = 0;
    var /** number */ I_p1 = 0;
    var /** number */ I_pV = 0;


    /** @return {boolean} */
    function r_prelude() {
        while(true)
        {
            var /** number */ v_1 = base.cursor;
            lab0: {
                golab1: while(true)
                {
                    var /** number */ v_2 = base.cursor;
                    lab2: {
                        lab3: {
                            var /** number */ v_3 = base.cursor;
                            lab4: {
                                if (!(base.in_grouping(g_v, 97, 251)))
                                {
                                    break lab4;
                                }
                                base.bra = base.cursor;
                                lab5: {
                                    var /** number */ v_4 = base.cursor;
                                    lab6: {
                                        if (!(base.eq_s("u")))
                                        {
                                            break lab6;
                                        }
                                        base.ket = base.cursor;
                                        if (!(base.in_grouping(g_v, 97, 251)))
                                        {
                                            break lab6;
                                        }
                                        if (!base.slice_from("U"))
                                        {
                                            return false;
                                        }
                                        break lab5;
                                    }
                                    base.cursor = v_4;
                                    lab7: {
                                        if (!(base.eq_s("i")))
                                        {
                                            break lab7;
                                        }
                                        base.ket = base.cursor;
                                        if (!(base.in_grouping(g_v, 97, 251)))
                                        {
                                            break lab7;
                                        }
                                        if (!base.slice_from("I"))
                                        {
                                            return false;
                                        }
                                        break lab5;
                                    }
                                    base.cursor = v_4;
                                    if (!(base.eq_s("y")))
                                    {
                                        break lab4;
                                    }
                                    base.ket = base.cursor;
                                    if (!base.slice_from("Y"))
                                    {
                                        return false;
                                    }
                                }
                                break lab3;
                            }
                            base.cursor = v_3;
                            lab8: {
                                base.bra = base.cursor;
                                if (!(base.eq_s("\u00EB")))
                                {
                                    break lab8;
                                }
                                base.ket = base.cursor;
                                if (!base.slice_from("He"))
                                {
                                    return false;
                                }
                                break lab3;
                            }
                            base.cursor = v_3;
                            lab9: {
                                base.bra = base.cursor;
                                if (!(base.eq_s("\u00EF")))
                                {
                                    break lab9;
                                }
                                base.ket = base.cursor;
                                if (!base.slice_from("Hi"))
                                {
                                    return false;
                                }
                                break lab3;
                            }
                            base.cursor = v_3;
                            lab10: {
                                base.bra = base.cursor;
                                if (!(base.eq_s("y")))
                                {
                                    break lab10;
                                }
                                base.ket = base.cursor;
                                if (!(base.in_grouping(g_v, 97, 251)))
                                {
                                    break lab10;
                                }
                                if (!base.slice_from("Y"))
                                {
                                    return false;
                                }
                                break lab3;
                            }
                            base.cursor = v_3;
                            if (!(base.eq_s("q")))
                            {
                                break lab2;
                            }
                            base.bra = base.cursor;
                            if (!(base.eq_s("u")))
                            {
                                break lab2;
                            }
                            base.ket = base.cursor;
                            if (!base.slice_from("U"))
                            {
                                return false;
                            }
                        }
                        base.cursor = v_2;
                        break golab1;
                    }
                    base.cursor = v_2;
                    if (base.cursor >= base.limit)
                    {
                        break lab0;
                    }
                    base.cursor++;
                }
                continue;
            }
            base.cursor = v_1;
            break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_regions() {
        I_pV = base.limit;
        I_p1 = base.limit;
        I_p2 = base.limit;
        var /** number */ v_1 = base.cursor;
        lab0: {
            lab1: {
                var /** number */ v_2 = base.cursor;
                lab2: {
                    if (!(base.in_grouping(g_v, 97, 251)))
                    {
                        break lab2;
                    }
                    if (!(base.in_grouping(g_v, 97, 251)))
                    {
                        break lab2;
                    }
                    if (base.cursor >= base.limit)
                    {
                        break lab2;
                    }
                    base.cursor++;
                    break lab1;
                }
                base.cursor = v_2;
                lab3: {
                    if (base.find_among(a_0) == 0)
                    {
                        break lab3;
                    }
                    break lab1;
                }
                base.cursor = v_2;
                if (base.cursor >= base.limit)
                {
                    break lab0;
                }
                base.cursor++;
                golab4: while(true)
                {
                    lab5: {
                        if (!(base.in_grouping(g_v, 97, 251)))
                        {
                            break lab5;
                        }
                        break golab4;
                    }
                    if (base.cursor >= base.limit)
                    {
                        break lab0;
                    }
                    base.cursor++;
                }
            }
            I_pV = base.cursor;
        }
        base.cursor = v_1;
        var /** number */ v_4 = base.cursor;
        lab6: {
            golab7: while(true)
            {
                lab8: {
                    if (!(base.in_grouping(g_v, 97, 251)))
                    {
                        break lab8;
                    }
                    break golab7;
                }
                if (base.cursor >= base.limit)
                {
                    break lab6;
                }
                base.cursor++;
            }
            golab9: while(true)
            {
                lab10: {
                    if (!(base.out_grouping(g_v, 97, 251)))
                    {
                        break lab10;
                    }
                    break golab9;
                }
                if (base.cursor >= base.limit)
                {
                    break lab6;
                }
                base.cursor++;
            }
            I_p1 = base.cursor;
            golab11: while(true)
            {
                lab12: {
                    if (!(base.in_grouping(g_v, 97, 251)))
                    {
                        break lab12;
                    }
                    break golab11;
                }
                if (base.cursor >= base.limit)
                {
                    break lab6;
                }
                base.cursor++;
            }
            golab13: while(true)
            {
                lab14: {
                    if (!(base.out_grouping(g_v, 97, 251)))
                    {
                        break lab14;
                    }
                    break golab13;
                }
                if (base.cursor >= base.limit)
                {
                    break lab6;
                }
                base.cursor++;
            }
            I_p2 = base.cursor;
        }
        base.cursor = v_4;
        return true;
    };

    /** @return {boolean} */
    function r_postlude() {
        var /** number */ among_var;
        while(true)
        {
            var /** number */ v_1 = base.cursor;
            lab0: {
                base.bra = base.cursor;
                among_var = base.find_among(a_1);
                if (among_var == 0)
                {
                    break lab0;
                }
                base.ket = base.cursor;
                switch (among_var) {
                    case 1:
                        if (!base.slice_from("i"))
                        {
                            return false;
                        }
                        break;
                    case 2:
                        if (!base.slice_from("u"))
                        {
                            return false;
                        }
                        break;
                    case 3:
                        if (!base.slice_from("y"))
                        {
                            return false;
                        }
                        break;
                    case 4:
                        if (!base.slice_from("\u00EB"))
                        {
                            return false;
                        }
                        break;
                    case 5:
                        if (!base.slice_from("\u00EF"))
                        {
                            return false;
                        }
                        break;
                    case 6:
                        if (!base.slice_del())
                        {
                            return false;
                        }
                        break;
                    case 7:
                        if (base.cursor >= base.limit)
                        {
                            break lab0;
                        }
                        base.cursor++;
                        break;
                }
                continue;
            }
            base.cursor = v_1;
            break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_RV() {
        if (!(I_pV <= base.cursor))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_R1() {
        if (!(I_p1 <= base.cursor))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_R2() {
        if (!(I_p2 <= base.cursor))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_standard_suffix() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_4);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!r_R2())
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!r_R2())
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_1 = base.limit - base.cursor;
                lab0: {
                    base.ket = base.cursor;
                    if (!(base.eq_s_b("ic")))
                    {
                        base.cursor = base.limit - v_1;
                        break lab0;
                    }
                    base.bra = base.cursor;
                    lab1: {
                        var /** number */ v_2 = base.limit - base.cursor;
                        lab2: {
                            if (!r_R2())
                            {
                                break lab2;
                            }
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            break lab1;
                        }
                        base.cursor = base.limit - v_2;
                        if (!base.slice_from("iqU"))
                        {
                            return false;
                        }
                    }
                }
                break;
            case 3:
                if (!r_R2())
                {
                    return false;
                }
                if (!base.slice_from("log"))
                {
                    return false;
                }
                break;
            case 4:
                if (!r_R2())
                {
                    return false;
                }
                if (!base.slice_from("u"))
                {
                    return false;
                }
                break;
            case 5:
                if (!r_R2())
                {
                    return false;
                }
                if (!base.slice_from("ent"))
                {
                    return false;
                }
                break;
            case 6:
                if (!r_RV())
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_3 = base.limit - base.cursor;
                lab3: {
                    base.ket = base.cursor;
                    among_var = base.find_among_b(a_2);
                    if (among_var == 0)
                    {
                        base.cursor = base.limit - v_3;
                        break lab3;
                    }
                    base.bra = base.cursor;
                    switch (among_var) {
                        case 1:
                            if (!r_R2())
                            {
                                base.cursor = base.limit - v_3;
                                break lab3;
                            }
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            base.ket = base.cursor;
                            if (!(base.eq_s_b("at")))
                            {
                                base.cursor = base.limit - v_3;
                                break lab3;
                            }
                            base.bra = base.cursor;
                            if (!r_R2())
                            {
                                base.cursor = base.limit - v_3;
                                break lab3;
                            }
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            break;
                        case 2:
                            lab4: {
                                var /** number */ v_4 = base.limit - base.cursor;
                                lab5: {
                                    if (!r_R2())
                                    {
                                        break lab5;
                                    }
                                    if (!base.slice_del())
                                    {
                                        return false;
                                    }
                                    break lab4;
                                }
                                base.cursor = base.limit - v_4;
                                if (!r_R1())
                                {
                                    base.cursor = base.limit - v_3;
                                    break lab3;
                                }
                                if (!base.slice_from("eux"))
                                {
                                    return false;
                                }
                            }
                            break;
                        case 3:
                            if (!r_R2())
                            {
                                base.cursor = base.limit - v_3;
                                break lab3;
                            }
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            break;
                        case 4:
                            if (!r_RV())
                            {
                                base.cursor = base.limit - v_3;
                                break lab3;
                            }
                            if (!base.slice_from("i"))
                            {
                                return false;
                            }
                            break;
                    }
                }
                break;
            case 7:
                if (!r_R2())
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_5 = base.limit - base.cursor;
                lab6: {
                    base.ket = base.cursor;
                    among_var = base.find_among_b(a_3);
                    if (among_var == 0)
                    {
                        base.cursor = base.limit - v_5;
                        break lab6;
                    }
                    base.bra = base.cursor;
                    switch (among_var) {
                        case 1:
                            lab7: {
                                var /** number */ v_6 = base.limit - base.cursor;
                                lab8: {
                                    if (!r_R2())
                                    {
                                        break lab8;
                                    }
                                    if (!base.slice_del())
                                    {
                                        return false;
                                    }
                                    break lab7;
                                }
                                base.cursor = base.limit - v_6;
                                if (!base.slice_from("abl"))
                                {
                                    return false;
                                }
                            }
                            break;
                        case 2:
                            lab9: {
                                var /** number */ v_7 = base.limit - base.cursor;
                                lab10: {
                                    if (!r_R2())
                                    {
                                        break lab10;
                                    }
                                    if (!base.slice_del())
                                    {
                                        return false;
                                    }
                                    break lab9;
                                }
                                base.cursor = base.limit - v_7;
                                if (!base.slice_from("iqU"))
                                {
                                    return false;
                                }
                            }
                            break;
                        case 3:
                            if (!r_R2())
                            {
                                base.cursor = base.limit - v_5;
                                break lab6;
                            }
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            break;
                    }
                }
                break;
            case 8:
                if (!r_R2())
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_8 = base.limit - base.cursor;
                lab11: {
                    base.ket = base.cursor;
                    if (!(base.eq_s_b("at")))
                    {
                        base.cursor = base.limit - v_8;
                        break lab11;
                    }
                    base.bra = base.cursor;
                    if (!r_R2())
                    {
                        base.cursor = base.limit - v_8;
                        break lab11;
                    }
                    if (!base.slice_del())
                    {
                        return false;
                    }
                    base.ket = base.cursor;
                    if (!(base.eq_s_b("ic")))
                    {
                        base.cursor = base.limit - v_8;
                        break lab11;
                    }
                    base.bra = base.cursor;
                    lab12: {
                        var /** number */ v_9 = base.limit - base.cursor;
                        lab13: {
                            if (!r_R2())
                            {
                                break lab13;
                            }
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            break lab12;
                        }
                        base.cursor = base.limit - v_9;
                        if (!base.slice_from("iqU"))
                        {
                            return false;
                        }
                    }
                }
                break;
            case 9:
                if (!base.slice_from("eau"))
                {
                    return false;
                }
                break;
            case 10:
                if (!r_R1())
                {
                    return false;
                }
                if (!base.slice_from("al"))
                {
                    return false;
                }
                break;
            case 11:
                lab14: {
                    var /** number */ v_10 = base.limit - base.cursor;
                    lab15: {
                        if (!r_R2())
                        {
                            break lab15;
                        }
                        if (!base.slice_del())
                        {
                            return false;
                        }
                        break lab14;
                    }
                    base.cursor = base.limit - v_10;
                    if (!r_R1())
                    {
                        return false;
                    }
                    if (!base.slice_from("eux"))
                    {
                        return false;
                    }
                }
                break;
            case 12:
                if (!r_R1())
                {
                    return false;
                }
                if (!(base.out_grouping_b(g_v, 97, 251)))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 13:
                if (!r_RV())
                {
                    return false;
                }
                if (!base.slice_from("ant"))
                {
                    return false;
                }
                return false;
            case 14:
                if (!r_RV())
                {
                    return false;
                }
                if (!base.slice_from("ent"))
                {
                    return false;
                }
                return false;
            case 15:
                var /** number */ v_11 = base.limit - base.cursor;
                if (!(base.in_grouping_b(g_v, 97, 251)))
                {
                    return false;
                }
                if (!r_RV())
                {
                    return false;
                }
                base.cursor = base.limit - v_11;
                if (!base.slice_del())
                {
                    return false;
                }
                return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_i_verb_suffix() {
        if (base.cursor < I_pV)
        {
            return false;
        }
        var /** number */ v_2 = base.limit_backward;
        base.limit_backward = I_pV;
        base.ket = base.cursor;
        if (base.find_among_b(a_5) == 0)
        {
            base.limit_backward = v_2;
            return false;
        }
        base.bra = base.cursor;
        {
            var /** number */ v_3 = base.limit - base.cursor;
            lab0: {
                if (!(base.eq_s_b("H")))
                {
                    break lab0;
                }
                base.limit_backward = v_2;
                return false;
            }
            base.cursor = base.limit - v_3;
        }
        if (!(base.out_grouping_b(g_v, 97, 251)))
        {
            base.limit_backward = v_2;
            return false;
        }
        if (!base.slice_del())
        {
            return false;
        }
        base.limit_backward = v_2;
        return true;
    };

    /** @return {boolean} */
    function r_verb_suffix() {
        var /** number */ among_var;
        if (base.cursor < I_pV)
        {
            return false;
        }
        var /** number */ v_2 = base.limit_backward;
        base.limit_backward = I_pV;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_6);
        if (among_var == 0)
        {
            base.limit_backward = v_2;
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!r_R2())
                {
                    base.limit_backward = v_2;
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_3 = base.limit - base.cursor;
                lab0: {
                    base.ket = base.cursor;
                    if (!(base.eq_s_b("e")))
                    {
                        base.cursor = base.limit - v_3;
                        break lab0;
                    }
                    base.bra = base.cursor;
                    if (!base.slice_del())
                    {
                        return false;
                    }
                }
                break;
        }
        base.limit_backward = v_2;
        return true;
    };

    /** @return {boolean} */
    function r_residual_suffix() {
        var /** number */ among_var;
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            base.ket = base.cursor;
            if (!(base.eq_s_b("s")))
            {
                base.cursor = base.limit - v_1;
                break lab0;
            }
            base.bra = base.cursor;
            var /** number */ v_2 = base.limit - base.cursor;
            lab1: {
                var /** number */ v_3 = base.limit - base.cursor;
                lab2: {
                    if (!(base.eq_s_b("Hi")))
                    {
                        break lab2;
                    }
                    break lab1;
                }
                base.cursor = base.limit - v_3;
                if (!(base.out_grouping_b(g_keep_with_s, 97, 232)))
                {
                    base.cursor = base.limit - v_1;
                    break lab0;
                }
            }
            base.cursor = base.limit - v_2;
            if (!base.slice_del())
            {
                return false;
            }
        }
        if (base.cursor < I_pV)
        {
            return false;
        }
        var /** number */ v_5 = base.limit_backward;
        base.limit_backward = I_pV;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_7);
        if (among_var == 0)
        {
            base.limit_backward = v_5;
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!r_R2())
                {
                    base.limit_backward = v_5;
                    return false;
                }
                lab3: {
                    var /** number */ v_6 = base.limit - base.cursor;
                    lab4: {
                        if (!(base.eq_s_b("s")))
                        {
                            break lab4;
                        }
                        break lab3;
                    }
                    base.cursor = base.limit - v_6;
                    if (!(base.eq_s_b("t")))
                    {
                        base.limit_backward = v_5;
                        return false;
                    }
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("i"))
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        base.limit_backward = v_5;
        return true;
    };

    /** @return {boolean} */
    function r_un_double() {
        var /** number */ v_1 = base.limit - base.cursor;
        if (base.find_among_b(a_8) == 0)
        {
            return false;
        }
        base.cursor = base.limit - v_1;
        base.ket = base.cursor;
        if (base.cursor <= base.limit_backward)
        {
            return false;
        }
        base.cursor--;
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_un_accent() {
        {
            var v_1 = 1;
            while(true)
            {
                lab0: {
                    if (!(base.out_grouping_b(g_v, 97, 251)))
                    {
                        break lab0;
                    }
                    v_1--;
                    continue;
                }
                break;
            }
            if (v_1 > 0)
            {
                return false;
            }
        }
        base.ket = base.cursor;
        lab1: {
            var /** number */ v_3 = base.limit - base.cursor;
            lab2: {
                if (!(base.eq_s_b("\u00E9")))
                {
                    break lab2;
                }
                break lab1;
            }
            base.cursor = base.limit - v_3;
            if (!(base.eq_s_b("\u00E8")))
            {
                return false;
            }
        }
        base.bra = base.cursor;
        if (!base.slice_from("e"))
        {
            return false;
        }
        return true;
    };

    this.stem = /** @return {boolean} */ function() {
        var /** number */ v_1 = base.cursor;
        r_prelude();
        base.cursor = v_1;
        r_mark_regions();
        base.limit_backward = base.cursor; base.cursor = base.limit;
        var /** number */ v_3 = base.limit - base.cursor;
        lab0: {
            lab1: {
                var /** number */ v_4 = base.limit - base.cursor;
                lab2: {
                    var /** number */ v_5 = base.limit - base.cursor;
                    lab3: {
                        var /** number */ v_6 = base.limit - base.cursor;
                        lab4: {
                            if (!r_standard_suffix())
                            {
                                break lab4;
                            }
                            break lab3;
                        }
                        base.cursor = base.limit - v_6;
                        lab5: {
                            if (!r_i_verb_suffix())
                            {
                                break lab5;
                            }
                            break lab3;
                        }
                        base.cursor = base.limit - v_6;
                        if (!r_verb_suffix())
                        {
                            break lab2;
                        }
                    }
                    base.cursor = base.limit - v_5;
                    var /** number */ v_7 = base.limit - base.cursor;
                    lab6: {
                        base.ket = base.cursor;
                        lab7: {
                            var /** number */ v_8 = base.limit - base.cursor;
                            lab8: {
                                if (!(base.eq_s_b("Y")))
                                {
                                    break lab8;
                                }
                                base.bra = base.cursor;
                                if (!base.slice_from("i"))
                                {
                                    return false;
                                }
                                break lab7;
                            }
                            base.cursor = base.limit - v_8;
                            if (!(base.eq_s_b("\u00E7")))
                            {
                                base.cursor = base.limit - v_7;
                                break lab6;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_from("c"))
                            {
                                return false;
                            }
                        }
                    }
                    break lab1;
                }
                base.cursor = base.limit - v_4;
                if (!r_residual_suffix())
                {
                    break lab0;
                }
            }
        }
        base.cursor = base.limit - v_3;
        var /** number */ v_9 = base.limit - base.cursor;
        r_un_double();
        base.cursor = base.limit - v_9;
        var /** number */ v_10 = base.limit - base.cursor;
        r_un_accent();
        base.cursor = base.limit - v_10;
        base.cursor = base.limit_backward;
        var /** number */ v_11 = base.cursor;
        r_postlude();
        base.cursor = v_11;
        return true;
    };

    /**@return{string}*/
    this['stemWord'] = function(/**string*/word) {
        base.setCurrent(word);
        this.stem();
        return base.getCurrent();
    };
};

// Generated by Snowball 2.2.0 - https://snowballstem.org/

/**@constructor*/
JsArabicStemmer = function() {
    var base = new BaseStemmer();
    /** @const */ var a_0 = [
        ["\u0640", -1, 1],
        ["\u064B", -1, 1],
        ["\u064C", -1, 1],
        ["\u064D", -1, 1],
        ["\u064E", -1, 1],
        ["\u064F", -1, 1],
        ["\u0650", -1, 1],
        ["\u0651", -1, 1],
        ["\u0652", -1, 1],
        ["\u0660", -1, 2],
        ["\u0661", -1, 3],
        ["\u0662", -1, 4],
        ["\u0663", -1, 5],
        ["\u0664", -1, 6],
        ["\u0665", -1, 7],
        ["\u0666", -1, 8],
        ["\u0667", -1, 9],
        ["\u0668", -1, 10],
        ["\u0669", -1, 11],
        ["\uFE80", -1, 12],
        ["\uFE81", -1, 16],
        ["\uFE82", -1, 16],
        ["\uFE83", -1, 13],
        ["\uFE84", -1, 13],
        ["\uFE85", -1, 17],
        ["\uFE86", -1, 17],
        ["\uFE87", -1, 14],
        ["\uFE88", -1, 14],
        ["\uFE89", -1, 15],
        ["\uFE8A", -1, 15],
        ["\uFE8B", -1, 15],
        ["\uFE8C", -1, 15],
        ["\uFE8D", -1, 18],
        ["\uFE8E", -1, 18],
        ["\uFE8F", -1, 19],
        ["\uFE90", -1, 19],
        ["\uFE91", -1, 19],
        ["\uFE92", -1, 19],
        ["\uFE93", -1, 20],
        ["\uFE94", -1, 20],
        ["\uFE95", -1, 21],
        ["\uFE96", -1, 21],
        ["\uFE97", -1, 21],
        ["\uFE98", -1, 21],
        ["\uFE99", -1, 22],
        ["\uFE9A", -1, 22],
        ["\uFE9B", -1, 22],
        ["\uFE9C", -1, 22],
        ["\uFE9D", -1, 23],
        ["\uFE9E", -1, 23],
        ["\uFE9F", -1, 23],
        ["\uFEA0", -1, 23],
        ["\uFEA1", -1, 24],
        ["\uFEA2", -1, 24],
        ["\uFEA3", -1, 24],
        ["\uFEA4", -1, 24],
        ["\uFEA5", -1, 25],
        ["\uFEA6", -1, 25],
        ["\uFEA7", -1, 25],
        ["\uFEA8", -1, 25],
        ["\uFEA9", -1, 26],
        ["\uFEAA", -1, 26],
        ["\uFEAB", -1, 27],
        ["\uFEAC", -1, 27],
        ["\uFEAD", -1, 28],
        ["\uFEAE", -1, 28],
        ["\uFEAF", -1, 29],
        ["\uFEB0", -1, 29],
        ["\uFEB1", -1, 30],
        ["\uFEB2", -1, 30],
        ["\uFEB3", -1, 30],
        ["\uFEB4", -1, 30],
        ["\uFEB5", -1, 31],
        ["\uFEB6", -1, 31],
        ["\uFEB7", -1, 31],
        ["\uFEB8", -1, 31],
        ["\uFEB9", -1, 32],
        ["\uFEBA", -1, 32],
        ["\uFEBB", -1, 32],
        ["\uFEBC", -1, 32],
        ["\uFEBD", -1, 33],
        ["\uFEBE", -1, 33],
        ["\uFEBF", -1, 33],
        ["\uFEC0", -1, 33],
        ["\uFEC1", -1, 34],
        ["\uFEC2", -1, 34],
        ["\uFEC3", -1, 34],
        ["\uFEC4", -1, 34],
        ["\uFEC5", -1, 35],
        ["\uFEC6", -1, 35],
        ["\uFEC7", -1, 35],
        ["\uFEC8", -1, 35],
        ["\uFEC9", -1, 36],
        ["\uFECA", -1, 36],
        ["\uFECB", -1, 36],
        ["\uFECC", -1, 36],
        ["\uFECD", -1, 37],
        ["\uFECE", -1, 37],
        ["\uFECF", -1, 37],
        ["\uFED0", -1, 37],
        ["\uFED1", -1, 38],
        ["\uFED2", -1, 38],
        ["\uFED3", -1, 38],
        ["\uFED4", -1, 38],
        ["\uFED5", -1, 39],
        ["\uFED6", -1, 39],
        ["\uFED7", -1, 39],
        ["\uFED8", -1, 39],
        ["\uFED9", -1, 40],
        ["\uFEDA", -1, 40],
        ["\uFEDB", -1, 40],
        ["\uFEDC", -1, 40],
        ["\uFEDD", -1, 41],
        ["\uFEDE", -1, 41],
        ["\uFEDF", -1, 41],
        ["\uFEE0", -1, 41],
        ["\uFEE1", -1, 42],
        ["\uFEE2", -1, 42],
        ["\uFEE3", -1, 42],
        ["\uFEE4", -1, 42],
        ["\uFEE5", -1, 43],
        ["\uFEE6", -1, 43],
        ["\uFEE7", -1, 43],
        ["\uFEE8", -1, 43],
        ["\uFEE9", -1, 44],
        ["\uFEEA", -1, 44],
        ["\uFEEB", -1, 44],
        ["\uFEEC", -1, 44],
        ["\uFEED", -1, 45],
        ["\uFEEE", -1, 45],
        ["\uFEEF", -1, 46],
        ["\uFEF0", -1, 46],
        ["\uFEF1", -1, 47],
        ["\uFEF2", -1, 47],
        ["\uFEF3", -1, 47],
        ["\uFEF4", -1, 47],
        ["\uFEF5", -1, 51],
        ["\uFEF6", -1, 51],
        ["\uFEF7", -1, 49],
        ["\uFEF8", -1, 49],
        ["\uFEF9", -1, 50],
        ["\uFEFA", -1, 50],
        ["\uFEFB", -1, 48],
        ["\uFEFC", -1, 48]
    ];

    /** @const */ var a_1 = [
        ["\u0622", -1, 1],
        ["\u0623", -1, 1],
        ["\u0624", -1, 1],
        ["\u0625", -1, 1],
        ["\u0626", -1, 1]
    ];

    /** @const */ var a_2 = [
        ["\u0622", -1, 1],
        ["\u0623", -1, 1],
        ["\u0624", -1, 2],
        ["\u0625", -1, 1],
        ["\u0626", -1, 3]
    ];

    /** @const */ var a_3 = [
        ["\u0627\u0644", -1, 2],
        ["\u0628\u0627\u0644", -1, 1],
        ["\u0643\u0627\u0644", -1, 1],
        ["\u0644\u0644", -1, 2]
    ];

    /** @const */ var a_4 = [
        ["\u0623\u0622", -1, 2],
        ["\u0623\u0623", -1, 1],
        ["\u0623\u0624", -1, 1],
        ["\u0623\u0625", -1, 4],
        ["\u0623\u0627", -1, 3]
    ];

    /** @const */ var a_5 = [
        ["\u0641", -1, 1],
        ["\u0648", -1, 1]
    ];

    /** @const */ var a_6 = [
        ["\u0627\u0644", -1, 2],
        ["\u0628\u0627\u0644", -1, 1],
        ["\u0643\u0627\u0644", -1, 1],
        ["\u0644\u0644", -1, 2]
    ];

    /** @const */ var a_7 = [
        ["\u0628", -1, 1],
        ["\u0628\u0627", 0, -1],
        ["\u0628\u0628", 0, 2],
        ["\u0643\u0643", -1, 3]
    ];

    /** @const */ var a_8 = [
        ["\u0633\u0623", -1, 4],
        ["\u0633\u062A", -1, 2],
        ["\u0633\u0646", -1, 3],
        ["\u0633\u064A", -1, 1]
    ];

    /** @const */ var a_9 = [
        ["\u062A\u0633\u062A", -1, 1],
        ["\u0646\u0633\u062A", -1, 1],
        ["\u064A\u0633\u062A", -1, 1]
    ];

    /** @const */ var a_10 = [
        ["\u0643\u0645\u0627", -1, 3],
        ["\u0647\u0645\u0627", -1, 3],
        ["\u0646\u0627", -1, 2],
        ["\u0647\u0627", -1, 2],
        ["\u0643", -1, 1],
        ["\u0643\u0645", -1, 2],
        ["\u0647\u0645", -1, 2],
        ["\u0647\u0646", -1, 2],
        ["\u0647", -1, 1],
        ["\u064A", -1, 1]
    ];

    /** @const */ var a_11 = [
        ["\u0646", -1, 1]
    ];

    /** @const */ var a_12 = [
        ["\u0627", -1, 1],
        ["\u0648", -1, 1],
        ["\u064A", -1, 1]
    ];

    /** @const */ var a_13 = [
        ["\u0627\u062A", -1, 1]
    ];

    /** @const */ var a_14 = [
        ["\u062A", -1, 1]
    ];

    /** @const */ var a_15 = [
        ["\u0629", -1, 1]
    ];

    /** @const */ var a_16 = [
        ["\u064A", -1, 1]
    ];

    /** @const */ var a_17 = [
        ["\u0643\u0645\u0627", -1, 3],
        ["\u0647\u0645\u0627", -1, 3],
        ["\u0646\u0627", -1, 2],
        ["\u0647\u0627", -1, 2],
        ["\u0643", -1, 1],
        ["\u0643\u0645", -1, 2],
        ["\u0647\u0645", -1, 2],
        ["\u0643\u0646", -1, 2],
        ["\u0647\u0646", -1, 2],
        ["\u0647", -1, 1],
        ["\u0643\u0645\u0648", -1, 3],
        ["\u0646\u064A", -1, 2]
    ];

    /** @const */ var a_18 = [
        ["\u0627", -1, 1],
        ["\u062A\u0627", 0, 2],
        ["\u062A\u0645\u0627", 0, 4],
        ["\u0646\u0627", 0, 2],
        ["\u062A", -1, 1],
        ["\u0646", -1, 1],
        ["\u0627\u0646", 5, 3],
        ["\u062A\u0646", 5, 2],
        ["\u0648\u0646", 5, 3],
        ["\u064A\u0646", 5, 3],
        ["\u064A", -1, 1]
    ];

    /** @const */ var a_19 = [
        ["\u0648\u0627", -1, 1],
        ["\u062A\u0645", -1, 1]
    ];

    /** @const */ var a_20 = [
        ["\u0648", -1, 1],
        ["\u062A\u0645\u0648", 0, 2]
    ];

    /** @const */ var a_21 = [
        ["\u0649", -1, 1]
    ];

    var /** boolean */ B_is_defined = false;
    var /** boolean */ B_is_verb = false;
    var /** boolean */ B_is_noun = false;


    /** @return {boolean} */
    function r_Normalize_pre() {
        var /** number */ among_var;
        var /** number */ v_1 = base.cursor;
        lab0: {
            while(true)
            {
                var /** number */ v_2 = base.cursor;
                lab1: {
                    lab2: {
                        var /** number */ v_3 = base.cursor;
                        lab3: {
                            base.bra = base.cursor;
                            among_var = base.find_among(a_0);
                            if (among_var == 0)
                            {
                                break lab3;
                            }
                            base.ket = base.cursor;
                            switch (among_var) {
                                case 1:
                                    if (!base.slice_del())
                                    {
                                        return false;
                                    }
                                    break;
                                case 2:
                                    if (!base.slice_from("0"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 3:
                                    if (!base.slice_from("1"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 4:
                                    if (!base.slice_from("2"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 5:
                                    if (!base.slice_from("3"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 6:
                                    if (!base.slice_from("4"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 7:
                                    if (!base.slice_from("5"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 8:
                                    if (!base.slice_from("6"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 9:
                                    if (!base.slice_from("7"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 10:
                                    if (!base.slice_from("8"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 11:
                                    if (!base.slice_from("9"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 12:
                                    if (!base.slice_from("\u0621"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 13:
                                    if (!base.slice_from("\u0623"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 14:
                                    if (!base.slice_from("\u0625"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 15:
                                    if (!base.slice_from("\u0626"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 16:
                                    if (!base.slice_from("\u0622"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 17:
                                    if (!base.slice_from("\u0624"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 18:
                                    if (!base.slice_from("\u0627"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 19:
                                    if (!base.slice_from("\u0628"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 20:
                                    if (!base.slice_from("\u0629"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 21:
                                    if (!base.slice_from("\u062A"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 22:
                                    if (!base.slice_from("\u062B"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 23:
                                    if (!base.slice_from("\u062C"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 24:
                                    if (!base.slice_from("\u062D"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 25:
                                    if (!base.slice_from("\u062E"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 26:
                                    if (!base.slice_from("\u062F"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 27:
                                    if (!base.slice_from("\u0630"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 28:
                                    if (!base.slice_from("\u0631"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 29:
                                    if (!base.slice_from("\u0632"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 30:
                                    if (!base.slice_from("\u0633"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 31:
                                    if (!base.slice_from("\u0634"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 32:
                                    if (!base.slice_from("\u0635"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 33:
                                    if (!base.slice_from("\u0636"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 34:
                                    if (!base.slice_from("\u0637"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 35:
                                    if (!base.slice_from("\u0638"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 36:
                                    if (!base.slice_from("\u0639"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 37:
                                    if (!base.slice_from("\u063A"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 38:
                                    if (!base.slice_from("\u0641"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 39:
                                    if (!base.slice_from("\u0642"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 40:
                                    if (!base.slice_from("\u0643"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 41:
                                    if (!base.slice_from("\u0644"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 42:
                                    if (!base.slice_from("\u0645"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 43:
                                    if (!base.slice_from("\u0646"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 44:
                                    if (!base.slice_from("\u0647"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 45:
                                    if (!base.slice_from("\u0648"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 46:
                                    if (!base.slice_from("\u0649"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 47:
                                    if (!base.slice_from("\u064A"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 48:
                                    if (!base.slice_from("\u0644\u0627"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 49:
                                    if (!base.slice_from("\u0644\u0623"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 50:
                                    if (!base.slice_from("\u0644\u0625"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 51:
                                    if (!base.slice_from("\u0644\u0622"))
                                    {
                                        return false;
                                    }
                                    break;
                            }
                            break lab2;
                        }
                        base.cursor = v_3;
                        if (base.cursor >= base.limit)
                        {
                            break lab1;
                        }
                        base.cursor++;
                    }
                    continue;
                }
                base.cursor = v_2;
                break;
            }
        }
        base.cursor = v_1;
        return true;
    };

    /** @return {boolean} */
    function r_Normalize_post() {
        var /** number */ among_var;
        var /** number */ v_1 = base.cursor;
        lab0: {
            base.limit_backward = base.cursor; base.cursor = base.limit;
            base.ket = base.cursor;
            if (base.find_among_b(a_1) == 0)
            {
                break lab0;
            }
            base.bra = base.cursor;
            if (!base.slice_from("\u0621"))
            {
                return false;
            }
            base.cursor = base.limit_backward;
        }
        base.cursor = v_1;
        var /** number */ v_2 = base.cursor;
        lab1: {
            while(true)
            {
                var /** number */ v_3 = base.cursor;
                lab2: {
                    lab3: {
                        var /** number */ v_4 = base.cursor;
                        lab4: {
                            base.bra = base.cursor;
                            among_var = base.find_among(a_2);
                            if (among_var == 0)
                            {
                                break lab4;
                            }
                            base.ket = base.cursor;
                            switch (among_var) {
                                case 1:
                                    if (!base.slice_from("\u0627"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 2:
                                    if (!base.slice_from("\u0648"))
                                    {
                                        return false;
                                    }
                                    break;
                                case 3:
                                    if (!base.slice_from("\u064A"))
                                    {
                                        return false;
                                    }
                                    break;
                            }
                            break lab3;
                        }
                        base.cursor = v_4;
                        if (base.cursor >= base.limit)
                        {
                            break lab2;
                        }
                        base.cursor++;
                    }
                    continue;
                }
                base.cursor = v_3;
                break;
            }
        }
        base.cursor = v_2;
        return true;
    };

    /** @return {boolean} */
    function r_Checks1() {
        var /** number */ among_var;
        base.bra = base.cursor;
        among_var = base.find_among(a_3);
        if (among_var == 0)
        {
            return false;
        }
        base.ket = base.cursor;
        switch (among_var) {
            case 1:
                if (!(base.current.length > 4))
                {
                    return false;
                }
                B_is_noun = true;
                B_is_verb = false;
                B_is_defined = true;
                break;
            case 2:
                if (!(base.current.length > 3))
                {
                    return false;
                }
                B_is_noun = true;
                B_is_verb = false;
                B_is_defined = true;
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Prefix_Step1() {
        var /** number */ among_var;
        base.bra = base.cursor;
        among_var = base.find_among(a_4);
        if (among_var == 0)
        {
            return false;
        }
        base.ket = base.cursor;
        switch (among_var) {
            case 1:
                if (!(base.current.length > 3))
                {
                    return false;
                }
                if (!base.slice_from("\u0623"))
                {
                    return false;
                }
                break;
            case 2:
                if (!(base.current.length > 3))
                {
                    return false;
                }
                if (!base.slice_from("\u0622"))
                {
                    return false;
                }
                break;
            case 3:
                if (!(base.current.length > 3))
                {
                    return false;
                }
                if (!base.slice_from("\u0627"))
                {
                    return false;
                }
                break;
            case 4:
                if (!(base.current.length > 3))
                {
                    return false;
                }
                if (!base.slice_from("\u0625"))
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Prefix_Step2() {
        base.bra = base.cursor;
        if (base.find_among(a_5) == 0)
        {
            return false;
        }
        base.ket = base.cursor;
        if (!(base.current.length > 3))
        {
            return false;
        }
        {
            var /** number */ v_1 = base.cursor;
            lab0: {
                if (!(base.eq_s("\u0627")))
                {
                    break lab0;
                }
                return false;
            }
            base.cursor = v_1;
        }
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Prefix_Step3a_Noun() {
        var /** number */ among_var;
        base.bra = base.cursor;
        among_var = base.find_among(a_6);
        if (among_var == 0)
        {
            return false;
        }
        base.ket = base.cursor;
        switch (among_var) {
            case 1:
                if (!(base.current.length > 5))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!(base.current.length > 4))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Prefix_Step3b_Noun() {
        var /** number */ among_var;
        base.bra = base.cursor;
        among_var = base.find_among(a_7);
        if (among_var == 0)
        {
            return false;
        }
        base.ket = base.cursor;
        switch (among_var) {
            case 1:
                if (!(base.current.length > 3))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!(base.current.length > 3))
                {
                    return false;
                }
                if (!base.slice_from("\u0628"))
                {
                    return false;
                }
                break;
            case 3:
                if (!(base.current.length > 3))
                {
                    return false;
                }
                if (!base.slice_from("\u0643"))
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Prefix_Step3_Verb() {
        var /** number */ among_var;
        base.bra = base.cursor;
        among_var = base.find_among(a_8);
        if (among_var == 0)
        {
            return false;
        }
        base.ket = base.cursor;
        switch (among_var) {
            case 1:
                if (!(base.current.length > 4))
                {
                    return false;
                }
                if (!base.slice_from("\u064A"))
                {
                    return false;
                }
                break;
            case 2:
                if (!(base.current.length > 4))
                {
                    return false;
                }
                if (!base.slice_from("\u062A"))
                {
                    return false;
                }
                break;
            case 3:
                if (!(base.current.length > 4))
                {
                    return false;
                }
                if (!base.slice_from("\u0646"))
                {
                    return false;
                }
                break;
            case 4:
                if (!(base.current.length > 4))
                {
                    return false;
                }
                if (!base.slice_from("\u0623"))
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Prefix_Step4_Verb() {
        base.bra = base.cursor;
        if (base.find_among(a_9) == 0)
        {
            return false;
        }
        base.ket = base.cursor;
        if (!(base.current.length > 4))
        {
            return false;
        }
        B_is_verb = true;
        B_is_noun = false;
        if (!base.slice_from("\u0627\u0633\u062A"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Noun_Step1a() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_10);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!(base.current.length >= 4))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!(base.current.length >= 5))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 3:
                if (!(base.current.length >= 6))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Noun_Step1b() {
        base.ket = base.cursor;
        if (base.find_among_b(a_11) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!(base.current.length > 5))
        {
            return false;
        }
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Noun_Step2a() {
        base.ket = base.cursor;
        if (base.find_among_b(a_12) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!(base.current.length > 4))
        {
            return false;
        }
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Noun_Step2b() {
        base.ket = base.cursor;
        if (base.find_among_b(a_13) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!(base.current.length >= 5))
        {
            return false;
        }
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Noun_Step2c1() {
        base.ket = base.cursor;
        if (base.find_among_b(a_14) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!(base.current.length >= 4))
        {
            return false;
        }
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Noun_Step2c2() {
        base.ket = base.cursor;
        if (base.find_among_b(a_15) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!(base.current.length >= 4))
        {
            return false;
        }
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Noun_Step3() {
        base.ket = base.cursor;
        if (base.find_among_b(a_16) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!(base.current.length >= 3))
        {
            return false;
        }
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Verb_Step1() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_17);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!(base.current.length >= 4))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!(base.current.length >= 5))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 3:
                if (!(base.current.length >= 6))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Verb_Step2a() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_18);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!(base.current.length >= 4))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!(base.current.length >= 5))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 3:
                if (!(base.current.length > 5))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 4:
                if (!(base.current.length >= 6))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Verb_Step2b() {
        base.ket = base.cursor;
        if (base.find_among_b(a_19) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!(base.current.length >= 5))
        {
            return false;
        }
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_Verb_Step2c() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_20);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!(base.current.length >= 4))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!(base.current.length >= 6))
                {
                    return false;
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_Suffix_All_alef_maqsura() {
        base.ket = base.cursor;
        if (base.find_among_b(a_21) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_from("\u064A"))
        {
            return false;
        }
        return true;
    };

    this.stem = /** @return {boolean} */ function() {
        B_is_noun = true;
        B_is_verb = true;
        B_is_defined = false;
        var /** number */ v_1 = base.cursor;
        r_Checks1();
        base.cursor = v_1;
        r_Normalize_pre();
        base.limit_backward = base.cursor; base.cursor = base.limit;
        var /** number */ v_3 = base.limit - base.cursor;
        lab0: {
            lab1: {
                var /** number */ v_4 = base.limit - base.cursor;
                lab2: {
                    if (!B_is_verb)
                    {
                        break lab2;
                    }
                    lab3: {
                        var /** number */ v_5 = base.limit - base.cursor;
                        lab4: {
                            {
                                var v_6 = 1;
                                while(true)
                                {
                                    var /** number */ v_7 = base.limit - base.cursor;
                                    lab5: {
                                        if (!r_Suffix_Verb_Step1())
                                        {
                                            break lab5;
                                        }
                                        v_6--;
                                        continue;
                                    }
                                    base.cursor = base.limit - v_7;
                                    break;
                                }
                                if (v_6 > 0)
                                {
                                    break lab4;
                                }
                            }
                            lab6: {
                                var /** number */ v_8 = base.limit - base.cursor;
                                lab7: {
                                    if (!r_Suffix_Verb_Step2a())
                                    {
                                        break lab7;
                                    }
                                    break lab6;
                                }
                                base.cursor = base.limit - v_8;
                                lab8: {
                                    if (!r_Suffix_Verb_Step2c())
                                    {
                                        break lab8;
                                    }
                                    break lab6;
                                }
                                base.cursor = base.limit - v_8;
                                if (base.cursor <= base.limit_backward)
                                {
                                    break lab4;
                                }
                                base.cursor--;
                            }
                            break lab3;
                        }
                        base.cursor = base.limit - v_5;
                        lab9: {
                            if (!r_Suffix_Verb_Step2b())
                            {
                                break lab9;
                            }
                            break lab3;
                        }
                        base.cursor = base.limit - v_5;
                        if (!r_Suffix_Verb_Step2a())
                        {
                            break lab2;
                        }
                    }
                    break lab1;
                }
                base.cursor = base.limit - v_4;
                lab10: {
                    if (!B_is_noun)
                    {
                        break lab10;
                    }
                    var /** number */ v_9 = base.limit - base.cursor;
                    lab11: {
                        lab12: {
                            var /** number */ v_10 = base.limit - base.cursor;
                            lab13: {
                                if (!r_Suffix_Noun_Step2c2())
                                {
                                    break lab13;
                                }
                                break lab12;
                            }
                            base.cursor = base.limit - v_10;
                            lab14: {
                                lab15: {
                                    if (!B_is_defined)
                                    {
                                        break lab15;
                                    }
                                    break lab14;
                                }
                                if (!r_Suffix_Noun_Step1a())
                                {
                                    break lab14;
                                }
                                lab16: {
                                    var /** number */ v_12 = base.limit - base.cursor;
                                    lab17: {
                                        if (!r_Suffix_Noun_Step2a())
                                        {
                                            break lab17;
                                        }
                                        break lab16;
                                    }
                                    base.cursor = base.limit - v_12;
                                    lab18: {
                                        if (!r_Suffix_Noun_Step2b())
                                        {
                                            break lab18;
                                        }
                                        break lab16;
                                    }
                                    base.cursor = base.limit - v_12;
                                    lab19: {
                                        if (!r_Suffix_Noun_Step2c1())
                                        {
                                            break lab19;
                                        }
                                        break lab16;
                                    }
                                    base.cursor = base.limit - v_12;
                                    if (base.cursor <= base.limit_backward)
                                    {
                                        break lab14;
                                    }
                                    base.cursor--;
                                }
                                break lab12;
                            }
                            base.cursor = base.limit - v_10;
                            lab20: {
                                if (!r_Suffix_Noun_Step1b())
                                {
                                    break lab20;
                                }
                                lab21: {
                                    var /** number */ v_13 = base.limit - base.cursor;
                                    lab22: {
                                        if (!r_Suffix_Noun_Step2a())
                                        {
                                            break lab22;
                                        }
                                        break lab21;
                                    }
                                    base.cursor = base.limit - v_13;
                                    lab23: {
                                        if (!r_Suffix_Noun_Step2b())
                                        {
                                            break lab23;
                                        }
                                        break lab21;
                                    }
                                    base.cursor = base.limit - v_13;
                                    if (!r_Suffix_Noun_Step2c1())
                                    {
                                        break lab20;
                                    }
                                }
                                break lab12;
                            }
                            base.cursor = base.limit - v_10;
                            lab24: {
                                lab25: {
                                    if (!B_is_defined)
                                    {
                                        break lab25;
                                    }
                                    break lab24;
                                }
                                if (!r_Suffix_Noun_Step2a())
                                {
                                    break lab24;
                                }
                                break lab12;
                            }
                            base.cursor = base.limit - v_10;
                            if (!r_Suffix_Noun_Step2b())
                            {
                                base.cursor = base.limit - v_9;
                                break lab11;
                            }
                        }
                    }
                    if (!r_Suffix_Noun_Step3())
                    {
                        break lab10;
                    }
                    break lab1;
                }
                base.cursor = base.limit - v_4;
                if (!r_Suffix_All_alef_maqsura())
                {
                    break lab0;
                }
            }
        }
        base.cursor = base.limit - v_3;
        base.cursor = base.limit_backward;
        var /** number */ v_15 = base.cursor;
        lab26: {
            var /** number */ v_16 = base.cursor;
            lab27: {
                if (!r_Prefix_Step1())
                {
                    base.cursor = v_16;
                    break lab27;
                }
            }
            var /** number */ v_17 = base.cursor;
            lab28: {
                if (!r_Prefix_Step2())
                {
                    base.cursor = v_17;
                    break lab28;
                }
            }
            lab29: {
                var /** number */ v_18 = base.cursor;
                lab30: {
                    if (!r_Prefix_Step3a_Noun())
                    {
                        break lab30;
                    }
                    break lab29;
                }
                base.cursor = v_18;
                lab31: {
                    if (!B_is_noun)
                    {
                        break lab31;
                    }
                    if (!r_Prefix_Step3b_Noun())
                    {
                        break lab31;
                    }
                    break lab29;
                }
                base.cursor = v_18;
                if (!B_is_verb)
                {
                    break lab26;
                }
                var /** number */ v_19 = base.cursor;
                lab32: {
                    if (!r_Prefix_Step3_Verb())
                    {
                        base.cursor = v_19;
                        break lab32;
                    }
                }
                if (!r_Prefix_Step4_Verb())
                {
                    break lab26;
                }
            }
        }
        base.cursor = v_15;
        r_Normalize_post();
        return true;
    };

    /**@return{string}*/
    this['stemWord'] = function(/**string*/word) {
        base.setCurrent(word);
        this.stem();
        return base.getCurrent();
    };
};

// Generated by Snowball 2.2.0 - https://snowballstem.org/

/**@constructor*/
JsGreekStemmer = function() {
    var base = new BaseStemmer();
    /** @const */ var a_0 = [
        ["", -1, 25],
        ["\u0386", 0, 1],
        ["\u0388", 0, 5],
        ["\u0389", 0, 7],
        ["\u038A", 0, 9],
        ["\u038C", 0, 15],
        ["\u038E", 0, 20],
        ["\u038F", 0, 24],
        ["\u0390", 0, 7],
        ["\u0391", 0, 1],
        ["\u0392", 0, 2],
        ["\u0393", 0, 3],
        ["\u0394", 0, 4],
        ["\u0395", 0, 5],
        ["\u0396", 0, 6],
        ["\u0397", 0, 7],
        ["\u0398", 0, 8],
        ["\u0399", 0, 9],
        ["\u039A", 0, 10],
        ["\u039B", 0, 11],
        ["\u039C", 0, 12],
        ["\u039D", 0, 13],
        ["\u039E", 0, 14],
        ["\u039F", 0, 15],
        ["\u03A0", 0, 16],
        ["\u03A1", 0, 17],
        ["\u03A3", 0, 18],
        ["\u03A4", 0, 19],
        ["\u03A5", 0, 20],
        ["\u03A6", 0, 21],
        ["\u03A7", 0, 22],
        ["\u03A8", 0, 23],
        ["\u03A9", 0, 24],
        ["\u03AA", 0, 9],
        ["\u03AB", 0, 20],
        ["\u03AC", 0, 1],
        ["\u03AD", 0, 5],
        ["\u03AE", 0, 7],
        ["\u03AF", 0, 9],
        ["\u03B0", 0, 20],
        ["\u03C2", 0, 18],
        ["\u03CA", 0, 7],
        ["\u03CB", 0, 20],
        ["\u03CC", 0, 15],
        ["\u03CD", 0, 20],
        ["\u03CE", 0, 24]
    ];

    /** @const */ var a_1 = [
        ["\u03C3\u03BA\u03B1\u03B3\u03B9\u03B1", -1, 2],
        ["\u03C6\u03B1\u03B3\u03B9\u03B1", -1, 1],
        ["\u03BF\u03BB\u03BF\u03B3\u03B9\u03B1", -1, 3],
        ["\u03C3\u03BF\u03B3\u03B9\u03B1", -1, 4],
        ["\u03C4\u03B1\u03C4\u03BF\u03B3\u03B9\u03B1", -1, 5],
        ["\u03BA\u03C1\u03B5\u03B1\u03C4\u03B1", -1, 6],
        ["\u03C0\u03B5\u03C1\u03B1\u03C4\u03B1", -1, 7],
        ["\u03C4\u03B5\u03C1\u03B1\u03C4\u03B1", -1, 8],
        ["\u03B3\u03B5\u03B3\u03BF\u03BD\u03BF\u03C4\u03B1", -1, 11],
        ["\u03BA\u03B1\u03B8\u03B5\u03C3\u03C4\u03C9\u03C4\u03B1", -1, 10],
        ["\u03C6\u03C9\u03C4\u03B1", -1, 9],
        ["\u03C0\u03B5\u03C1\u03B1\u03C4\u03B7", -1, 7],
        ["\u03C3\u03BA\u03B1\u03B3\u03B9\u03C9\u03BD", -1, 2],
        ["\u03C6\u03B1\u03B3\u03B9\u03C9\u03BD", -1, 1],
        ["\u03BF\u03BB\u03BF\u03B3\u03B9\u03C9\u03BD", -1, 3],
        ["\u03C3\u03BF\u03B3\u03B9\u03C9\u03BD", -1, 4],
        ["\u03C4\u03B1\u03C4\u03BF\u03B3\u03B9\u03C9\u03BD", -1, 5],
        ["\u03BA\u03C1\u03B5\u03B1\u03C4\u03C9\u03BD", -1, 6],
        ["\u03C0\u03B5\u03C1\u03B1\u03C4\u03C9\u03BD", -1, 7],
        ["\u03C4\u03B5\u03C1\u03B1\u03C4\u03C9\u03BD", -1, 8],
        ["\u03B3\u03B5\u03B3\u03BF\u03BD\u03BF\u03C4\u03C9\u03BD", -1, 11],
        ["\u03BA\u03B1\u03B8\u03B5\u03C3\u03C4\u03C9\u03C4\u03C9\u03BD", -1, 10],
        ["\u03C6\u03C9\u03C4\u03C9\u03BD", -1, 9],
        ["\u03BA\u03C1\u03B5\u03B1\u03C3", -1, 6],
        ["\u03C0\u03B5\u03C1\u03B1\u03C3", -1, 7],
        ["\u03C4\u03B5\u03C1\u03B1\u03C3", -1, 8],
        ["\u03B3\u03B5\u03B3\u03BF\u03BD\u03BF\u03C3", -1, 11],
        ["\u03BA\u03C1\u03B5\u03B1\u03C4\u03BF\u03C3", -1, 6],
        ["\u03C0\u03B5\u03C1\u03B1\u03C4\u03BF\u03C3", -1, 7],
        ["\u03C4\u03B5\u03C1\u03B1\u03C4\u03BF\u03C3", -1, 8],
        ["\u03B3\u03B5\u03B3\u03BF\u03BD\u03BF\u03C4\u03BF\u03C3", -1, 11],
        ["\u03BA\u03B1\u03B8\u03B5\u03C3\u03C4\u03C9\u03C4\u03BF\u03C3", -1, 10],
        ["\u03C6\u03C9\u03C4\u03BF\u03C3", -1, 9],
        ["\u03BA\u03B1\u03B8\u03B5\u03C3\u03C4\u03C9\u03C3", -1, 10],
        ["\u03C6\u03C9\u03C3", -1, 9],
        ["\u03C3\u03BA\u03B1\u03B3\u03B9\u03BF\u03C5", -1, 2],
        ["\u03C6\u03B1\u03B3\u03B9\u03BF\u03C5", -1, 1],
        ["\u03BF\u03BB\u03BF\u03B3\u03B9\u03BF\u03C5", -1, 3],
        ["\u03C3\u03BF\u03B3\u03B9\u03BF\u03C5", -1, 4],
        ["\u03C4\u03B1\u03C4\u03BF\u03B3\u03B9\u03BF\u03C5", -1, 5]
    ];

    /** @const */ var a_2 = [
        ["\u03C0\u03B1", -1, 1],
        ["\u03BE\u03B1\u03BD\u03B1\u03C0\u03B1", 0, 1],
        ["\u03B5\u03C0\u03B1", 0, 1],
        ["\u03C0\u03B5\u03C1\u03B9\u03C0\u03B1", 0, 1],
        ["\u03B1\u03BD\u03B1\u03BC\u03C0\u03B1", 0, 1],
        ["\u03B5\u03BC\u03C0\u03B1", 0, 1],
        ["\u03B2", -1, 2],
        ["\u03B4\u03B1\u03BD\u03B5", -1, 1],
        ["\u03B2\u03B1\u03B8\u03C5\u03C1\u03B9", -1, 2],
        ["\u03B2\u03B1\u03C1\u03BA", -1, 2],
        ["\u03BC\u03B1\u03C1\u03BA", -1, 2],
        ["\u03BB", -1, 2],
        ["\u03BC", -1, 2],
        ["\u03BA\u03BF\u03C1\u03BD", -1, 2],
        ["\u03B1\u03B8\u03C1\u03BF", -1, 1],
        ["\u03C3\u03C5\u03BD\u03B1\u03B8\u03C1\u03BF", 14, 1],
        ["\u03C0", -1, 2],
        ["\u03B9\u03BC\u03C0", 16, 2],
        ["\u03C1", -1, 2],
        ["\u03BC\u03B1\u03C1", 18, 2],
        ["\u03B1\u03BC\u03C0\u03B1\u03C1", 18, 2],
        ["\u03B3\u03BA\u03C1", 18, 2],
        ["\u03B2\u03BF\u03BB\u03B2\u03BF\u03C1", 18, 2],
        ["\u03B3\u03BB\u03C5\u03BA\u03BF\u03C1", 18, 2],
        ["\u03C0\u03B9\u03C0\u03B5\u03C1\u03BF\u03C1", 18, 2],
        ["\u03C0\u03C1", 18, 2],
        ["\u03BC\u03C0\u03C1", 25, 2],
        ["\u03B1\u03C1\u03C1", 18, 2],
        ["\u03B3\u03BB\u03C5\u03BA\u03C5\u03C1", 18, 2],
        ["\u03C0\u03BF\u03BB\u03C5\u03C1", 18, 2],
        ["\u03BB\u03BF\u03C5", -1, 2]
    ];

    /** @const */ var a_3 = [
        ["\u03B9\u03B6\u03B1", -1, 1],
        ["\u03B9\u03B6\u03B5", -1, 1],
        ["\u03B9\u03B6\u03B1\u03BC\u03B5", -1, 1],
        ["\u03B9\u03B6\u03BF\u03C5\u03BC\u03B5", -1, 1],
        ["\u03B9\u03B6\u03B1\u03BD\u03B5", -1, 1],
        ["\u03B9\u03B6\u03BF\u03C5\u03BD\u03B5", -1, 1],
        ["\u03B9\u03B6\u03B1\u03C4\u03B5", -1, 1],
        ["\u03B9\u03B6\u03B5\u03C4\u03B5", -1, 1],
        ["\u03B9\u03B6\u03B5\u03B9", -1, 1],
        ["\u03B9\u03B6\u03B1\u03BD", -1, 1],
        ["\u03B9\u03B6\u03BF\u03C5\u03BD", -1, 1],
        ["\u03B9\u03B6\u03B5\u03C3", -1, 1],
        ["\u03B9\u03B6\u03B5\u03B9\u03C3", -1, 1],
        ["\u03B9\u03B6\u03C9", -1, 1]
    ];

    /** @const */ var a_4 = [
        ["\u03B2\u03B9", -1, 1],
        ["\u03BB\u03B9", -1, 1],
        ["\u03B1\u03BB", -1, 1],
        ["\u03B5\u03BD", -1, 1],
        ["\u03C3", -1, 1],
        ["\u03C7", -1, 1],
        ["\u03C5\u03C8", -1, 1],
        ["\u03B6\u03C9", -1, 1]
    ];

    /** @const */ var a_5 = [
        ["\u03C9\u03B8\u03B7\u03BA\u03B1", -1, 1],
        ["\u03C9\u03B8\u03B7\u03BA\u03B5", -1, 1],
        ["\u03C9\u03B8\u03B7\u03BA\u03B1\u03BC\u03B5", -1, 1],
        ["\u03C9\u03B8\u03B7\u03BA\u03B1\u03BD\u03B5", -1, 1],
        ["\u03C9\u03B8\u03B7\u03BA\u03B1\u03C4\u03B5", -1, 1],
        ["\u03C9\u03B8\u03B7\u03BA\u03B1\u03BD", -1, 1],
        ["\u03C9\u03B8\u03B7\u03BA\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_6 = [
        ["\u03BE\u03B1\u03BD\u03B1\u03C0\u03B1", -1, 1],
        ["\u03B5\u03C0\u03B1", -1, 1],
        ["\u03C0\u03B5\u03C1\u03B9\u03C0\u03B1", -1, 1],
        ["\u03B1\u03BD\u03B1\u03BC\u03C0\u03B1", -1, 1],
        ["\u03B5\u03BC\u03C0\u03B1", -1, 1],
        ["\u03C7\u03B1\u03C1\u03C4\u03BF\u03C0\u03B1", -1, 1],
        ["\u03B5\u03BE\u03B1\u03C1\u03C7\u03B1", -1, 1],
        ["\u03B3\u03B5", -1, 2],
        ["\u03B3\u03BA\u03B5", -1, 2],
        ["\u03BA\u03BB\u03B5", -1, 1],
        ["\u03B5\u03BA\u03BB\u03B5", 9, 1],
        ["\u03B1\u03C0\u03B5\u03BA\u03BB\u03B5", 10, 1],
        ["\u03B1\u03C0\u03BF\u03BA\u03BB\u03B5", 9, 1],
        ["\u03B5\u03C3\u03C9\u03BA\u03BB\u03B5", 9, 1],
        ["\u03B4\u03B1\u03BD\u03B5", -1, 1],
        ["\u03C0\u03B5", -1, 1],
        ["\u03B5\u03C0\u03B5", 15, 1],
        ["\u03BC\u03B5\u03C4\u03B5\u03C0\u03B5", 16, 1],
        ["\u03B5\u03C3\u03B5", -1, 1],
        ["\u03B3\u03BA", -1, 2],
        ["\u03BC", -1, 2],
        ["\u03C0\u03BF\u03C5\u03BA\u03B1\u03BC", 20, 2],
        ["\u03BA\u03BF\u03BC", 20, 2],
        ["\u03B1\u03BD", -1, 2],
        ["\u03BF\u03BB\u03BF", -1, 2],
        ["\u03B1\u03B8\u03C1\u03BF", -1, 1],
        ["\u03C3\u03C5\u03BD\u03B1\u03B8\u03C1\u03BF", 25, 1],
        ["\u03C0", -1, 2],
        ["\u03BB\u03B1\u03C1", -1, 2],
        ["\u03B4\u03B7\u03BC\u03BF\u03BA\u03C1\u03B1\u03C4", -1, 2],
        ["\u03B1\u03C6", -1, 2],
        ["\u03B3\u03B9\u03B3\u03B1\u03BD\u03C4\u03BF\u03B1\u03C6", 30, 2]
    ];

    /** @const */ var a_7 = [
        ["\u03B9\u03C3\u03B1", -1, 1],
        ["\u03B9\u03C3\u03B1\u03BC\u03B5", -1, 1],
        ["\u03B9\u03C3\u03B1\u03BD\u03B5", -1, 1],
        ["\u03B9\u03C3\u03B5", -1, 1],
        ["\u03B9\u03C3\u03B1\u03C4\u03B5", -1, 1],
        ["\u03B9\u03C3\u03B1\u03BD", -1, 1],
        ["\u03B9\u03C3\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_8 = [
        ["\u03BE\u03B1\u03BD\u03B1\u03C0\u03B1", -1, 1],
        ["\u03B5\u03C0\u03B1", -1, 1],
        ["\u03C0\u03B5\u03C1\u03B9\u03C0\u03B1", -1, 1],
        ["\u03B1\u03BD\u03B1\u03BC\u03C0\u03B1", -1, 1],
        ["\u03B5\u03BC\u03C0\u03B1", -1, 1],
        ["\u03C7\u03B1\u03C1\u03C4\u03BF\u03C0\u03B1", -1, 1],
        ["\u03B5\u03BE\u03B1\u03C1\u03C7\u03B1", -1, 1],
        ["\u03BA\u03BB\u03B5", -1, 1],
        ["\u03B5\u03BA\u03BB\u03B5", 7, 1],
        ["\u03B1\u03C0\u03B5\u03BA\u03BB\u03B5", 8, 1],
        ["\u03B1\u03C0\u03BF\u03BA\u03BB\u03B5", 7, 1],
        ["\u03B5\u03C3\u03C9\u03BA\u03BB\u03B5", 7, 1],
        ["\u03B4\u03B1\u03BD\u03B5", -1, 1],
        ["\u03C0\u03B5", -1, 1],
        ["\u03B5\u03C0\u03B5", 13, 1],
        ["\u03BC\u03B5\u03C4\u03B5\u03C0\u03B5", 14, 1],
        ["\u03B5\u03C3\u03B5", -1, 1],
        ["\u03B1\u03B8\u03C1\u03BF", -1, 1],
        ["\u03C3\u03C5\u03BD\u03B1\u03B8\u03C1\u03BF", 17, 1]
    ];

    /** @const */ var a_9 = [
        ["\u03B9\u03C3\u03BF\u03C5\u03BC\u03B5", -1, 1],
        ["\u03B9\u03C3\u03BF\u03C5\u03BD\u03B5", -1, 1],
        ["\u03B9\u03C3\u03B5\u03C4\u03B5", -1, 1],
        ["\u03B9\u03C3\u03B5\u03B9", -1, 1],
        ["\u03B9\u03C3\u03BF\u03C5\u03BD", -1, 1],
        ["\u03B9\u03C3\u03B5\u03B9\u03C3", -1, 1],
        ["\u03B9\u03C3\u03C9", -1, 1]
    ];

    /** @const */ var a_10 = [
        ["\u03B1\u03C4\u03B1", -1, 2],
        ["\u03C6\u03B1", -1, 2],
        ["\u03B7\u03C6\u03B1", 1, 2],
        ["\u03BC\u03B5\u03B3", -1, 2],
        ["\u03BB\u03C5\u03B3", -1, 2],
        ["\u03B7\u03B4", -1, 2],
        ["\u03BA\u03BB\u03B5", -1, 1],
        ["\u03B5\u03C3\u03C9\u03BA\u03BB\u03B5", 6, 1],
        ["\u03C0\u03BB\u03B5", -1, 1],
        ["\u03B4\u03B1\u03BD\u03B5", -1, 1],
        ["\u03C3\u03B5", -1, 1],
        ["\u03B1\u03C3\u03B5", 10, 1],
        ["\u03BA\u03B1\u03B8", -1, 2],
        ["\u03B5\u03C7\u03B8", -1, 2],
        ["\u03BA\u03B1\u03BA", -1, 2],
        ["\u03BC\u03B1\u03BA", -1, 2],
        ["\u03C3\u03BA", -1, 2],
        ["\u03C6\u03B9\u03BB", -1, 2],
        ["\u03BA\u03C5\u03BB", -1, 2],
        ["\u03BC", -1, 2],
        ["\u03B3\u03B5\u03BC", 19, 2],
        ["\u03B1\u03C7\u03BD", -1, 2],
        ["\u03C3\u03C5\u03BD\u03B1\u03B8\u03C1\u03BF", -1, 1],
        ["\u03C0", -1, 2],
        ["\u03B1\u03C0", 23, 2],
        ["\u03B5\u03BC\u03C0", 23, 2],
        ["\u03B5\u03C5\u03C0", 23, 2],
        ["\u03B1\u03C1", -1, 2],
        ["\u03B1\u03BF\u03C1", -1, 2],
        ["\u03B3\u03C5\u03C1", -1, 2],
        ["\u03C7\u03C1", -1, 2],
        ["\u03C7\u03C9\u03C1", -1, 2],
        ["\u03BA\u03C4", -1, 2],
        ["\u03B1\u03BA\u03C4", 32, 2],
        ["\u03C7\u03C4", -1, 2],
        ["\u03B1\u03C7\u03C4", 34, 2],
        ["\u03C4\u03B1\u03C7", -1, 2],
        ["\u03C3\u03C7", -1, 2],
        ["\u03B1\u03C3\u03C7", 37, 2],
        ["\u03C5\u03C8", -1, 2]
    ];

    /** @const */ var a_11 = [
        ["\u03B9\u03C3\u03C4\u03B1", -1, 1],
        ["\u03B9\u03C3\u03C4\u03B5", -1, 1],
        ["\u03B9\u03C3\u03C4\u03B7", -1, 1],
        ["\u03B9\u03C3\u03C4\u03BF\u03B9", -1, 1],
        ["\u03B9\u03C3\u03C4\u03C9\u03BD", -1, 1],
        ["\u03B9\u03C3\u03C4\u03BF", -1, 1],
        ["\u03B9\u03C3\u03C4\u03B5\u03C3", -1, 1],
        ["\u03B9\u03C3\u03C4\u03B7\u03C3", -1, 1],
        ["\u03B9\u03C3\u03C4\u03BF\u03C3", -1, 1],
        ["\u03B9\u03C3\u03C4\u03BF\u03C5\u03C3", -1, 1],
        ["\u03B9\u03C3\u03C4\u03BF\u03C5", -1, 1]
    ];

    /** @const */ var a_12 = [
        ["\u03B5\u03B3\u03BA\u03BB\u03B5", -1, 1],
        ["\u03B1\u03C0\u03BF\u03BA\u03BB\u03B5", -1, 1],
        ["\u03B4\u03B1\u03BD\u03B5", -1, 2],
        ["\u03B1\u03BD\u03C4\u03B9\u03B4\u03B1\u03BD\u03B5", 2, 2],
        ["\u03C3\u03B5", -1, 1],
        ["\u03BC\u03B5\u03C4\u03B1\u03C3\u03B5", 4, 1],
        ["\u03BC\u03B9\u03BA\u03C1\u03BF\u03C3\u03B5", 4, 1]
    ];

    /** @const */ var a_13 = [
        ["\u03B1\u03C4\u03BF\u03BC\u03B9\u03BA", -1, 2],
        ["\u03B5\u03B8\u03BD\u03B9\u03BA", -1, 4],
        ["\u03C4\u03BF\u03C0\u03B9\u03BA", -1, 7],
        ["\u03B5\u03BA\u03BB\u03B5\u03BA\u03C4\u03B9\u03BA", -1, 5],
        ["\u03C3\u03BA\u03B5\u03C0\u03C4\u03B9\u03BA", -1, 6],
        ["\u03B3\u03BD\u03C9\u03C3\u03C4\u03B9\u03BA", -1, 3],
        ["\u03B1\u03B3\u03BD\u03C9\u03C3\u03C4\u03B9\u03BA", 5, 1],
        ["\u03B1\u03BB\u03B5\u03BE\u03B1\u03BD\u03B4\u03C1\u03B9\u03BD", -1, 8],
        ["\u03B8\u03B5\u03B1\u03C4\u03C1\u03B9\u03BD", -1, 10],
        ["\u03B2\u03C5\u03B6\u03B1\u03BD\u03C4\u03B9\u03BD", -1, 9]
    ];

    /** @const */ var a_14 = [
        ["\u03B9\u03C3\u03BC\u03BF\u03B9", -1, 1],
        ["\u03B9\u03C3\u03BC\u03C9\u03BD", -1, 1],
        ["\u03B9\u03C3\u03BC\u03BF", -1, 1],
        ["\u03B9\u03C3\u03BC\u03BF\u03C3", -1, 1],
        ["\u03B9\u03C3\u03BC\u03BF\u03C5\u03C3", -1, 1],
        ["\u03B9\u03C3\u03BC\u03BF\u03C5", -1, 1]
    ];

    /** @const */ var a_15 = [
        ["\u03C3", -1, 1],
        ["\u03C7", -1, 1]
    ];

    /** @const */ var a_16 = [
        ["\u03BF\u03C5\u03B4\u03B1\u03BA\u03B9\u03B1", -1, 1],
        ["\u03B1\u03C1\u03B1\u03BA\u03B9\u03B1", -1, 1],
        ["\u03BF\u03C5\u03B4\u03B1\u03BA\u03B9", -1, 1],
        ["\u03B1\u03C1\u03B1\u03BA\u03B9", -1, 1]
    ];

    /** @const */ var a_17 = [
        ["\u03B2", -1, 2],
        ["\u03B2\u03B1\u03BC\u03B2", 0, 1],
        ["\u03C3\u03BB\u03BF\u03B2", 0, 1],
        ["\u03C4\u03C3\u03B5\u03C7\u03BF\u03C3\u03BB\u03BF\u03B2", 2, 1],
        ["\u03BA\u03B1\u03C1\u03B4", -1, 2],
        ["\u03B6", -1, 2],
        ["\u03C4\u03B6", 5, 1],
        ["\u03BA", -1, 1],
        ["\u03BA\u03B1\u03C0\u03B1\u03BA", 7, 1],
        ["\u03C3\u03BF\u03BA", 7, 1],
        ["\u03C3\u03BA", 7, 1],
        ["\u03B2\u03B1\u03BB", -1, 2],
        ["\u03BC\u03B1\u03BB", -1, 1],
        ["\u03B3\u03BB", -1, 2],
        ["\u03C4\u03C1\u03B9\u03C0\u03BF\u03BB", -1, 2],
        ["\u03C0\u03BB", -1, 1],
        ["\u03BB\u03BF\u03C5\u03BB", -1, 1],
        ["\u03C6\u03C5\u03BB", -1, 1],
        ["\u03BA\u03B1\u03B9\u03BC", -1, 1],
        ["\u03BA\u03BB\u03B9\u03BC", -1, 1],
        ["\u03C6\u03B1\u03C1\u03BC", -1, 1],
        ["\u03B3\u03B9\u03B1\u03BD", -1, 2],
        ["\u03C3\u03C0\u03B1\u03BD", -1, 1],
        ["\u03B7\u03B3\u03BF\u03C5\u03BC\u03B5\u03BD", -1, 2],
        ["\u03BA\u03BF\u03BD", -1, 1],
        ["\u03BC\u03B1\u03BA\u03C1\u03C5\u03BD", -1, 2],
        ["\u03C0", -1, 2],
        ["\u03BA\u03B1\u03C4\u03C1\u03B1\u03C0", 26, 1],
        ["\u03C1", -1, 1],
        ["\u03B2\u03C1", 28, 1],
        ["\u03BB\u03B1\u03B2\u03C1", 29, 1],
        ["\u03B1\u03BC\u03B2\u03C1", 29, 1],
        ["\u03BC\u03B5\u03C1", 28, 1],
        ["\u03C0\u03B1\u03C4\u03B5\u03C1", 28, 2],
        ["\u03B1\u03BD\u03B8\u03C1", 28, 1],
        ["\u03BA\u03BF\u03C1", 28, 1],
        ["\u03C3", -1, 1],
        ["\u03BD\u03B1\u03B3\u03BA\u03B1\u03C3", 36, 1],
        ["\u03C4\u03BF\u03C3", 36, 2],
        ["\u03BC\u03BF\u03C5\u03C3\u03C4", -1, 1],
        ["\u03C1\u03C5", -1, 1],
        ["\u03C6", -1, 1],
        ["\u03C3\u03C6", 41, 1],
        ["\u03B1\u03BB\u03B9\u03C3\u03C6", 42, 1],
        ["\u03BD\u03C5\u03C6", 41, 2],
        ["\u03C7", -1, 1]
    ];

    /** @const */ var a_18 = [
        ["\u03B1\u03BA\u03B9\u03B1", -1, 1],
        ["\u03B1\u03C1\u03B1\u03BA\u03B9\u03B1", 0, 1],
        ["\u03B9\u03C4\u03C3\u03B1", -1, 1],
        ["\u03B1\u03BA\u03B9", -1, 1],
        ["\u03B1\u03C1\u03B1\u03BA\u03B9", 3, 1],
        ["\u03B9\u03C4\u03C3\u03C9\u03BD", -1, 1],
        ["\u03B9\u03C4\u03C3\u03B1\u03C3", -1, 1],
        ["\u03B9\u03C4\u03C3\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_19 = [
        ["\u03C8\u03B1\u03BB", -1, 1],
        ["\u03B1\u03B9\u03C6\u03BD", -1, 1],
        ["\u03BF\u03BB\u03BF", -1, 1],
        ["\u03B9\u03C1", -1, 1]
    ];

    /** @const */ var a_20 = [
        ["\u03B5", -1, 1],
        ["\u03C0\u03B1\u03B9\u03C7\u03BD", -1, 1]
    ];

    /** @const */ var a_21 = [
        ["\u03B9\u03B4\u03B9\u03B1", -1, 1],
        ["\u03B9\u03B4\u03B9\u03C9\u03BD", -1, 1],
        ["\u03B9\u03B4\u03B9\u03BF", -1, 1]
    ];

    /** @const */ var a_22 = [
        ["\u03B9\u03B2", -1, 1],
        ["\u03B4", -1, 1],
        ["\u03C6\u03C1\u03B1\u03B3\u03BA", -1, 1],
        ["\u03BB\u03C5\u03BA", -1, 1],
        ["\u03BF\u03B2\u03B5\u03BB", -1, 1],
        ["\u03BC\u03B7\u03BD", -1, 1],
        ["\u03C1", -1, 1]
    ];

    /** @const */ var a_23 = [
        ["\u03B9\u03C3\u03BA\u03B5", -1, 1],
        ["\u03B9\u03C3\u03BA\u03BF", -1, 1],
        ["\u03B9\u03C3\u03BA\u03BF\u03C3", -1, 1],
        ["\u03B9\u03C3\u03BA\u03BF\u03C5", -1, 1]
    ];

    /** @const */ var a_24 = [
        ["\u03B1\u03B4\u03C9\u03BD", -1, 1],
        ["\u03B1\u03B4\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_25 = [
        ["\u03B3\u03B9\u03B1\u03B3\u03B9", -1, -1],
        ["\u03B8\u03B5\u03B9", -1, -1],
        ["\u03BF\u03BA", -1, -1],
        ["\u03BC\u03B1\u03BC", -1, -1],
        ["\u03BC\u03B1\u03BD", -1, -1],
        ["\u03BC\u03C0\u03B1\u03BC\u03C0", -1, -1],
        ["\u03C0\u03B5\u03B8\u03B5\u03C1", -1, -1],
        ["\u03C0\u03B1\u03C4\u03B5\u03C1", -1, -1],
        ["\u03BA\u03C5\u03C1", -1, -1],
        ["\u03BD\u03C4\u03B1\u03BD\u03C4", -1, -1]
    ];

    /** @const */ var a_26 = [
        ["\u03B5\u03B4\u03C9\u03BD", -1, 1],
        ["\u03B5\u03B4\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_27 = [
        ["\u03BC\u03B9\u03BB", -1, 1],
        ["\u03B4\u03B1\u03C0", -1, 1],
        ["\u03B3\u03B7\u03C0", -1, 1],
        ["\u03B9\u03C0", -1, 1],
        ["\u03B5\u03BC\u03C0", -1, 1],
        ["\u03BF\u03C0", -1, 1],
        ["\u03BA\u03C1\u03B1\u03C3\u03C0", -1, 1],
        ["\u03C5\u03C0", -1, 1]
    ];

    /** @const */ var a_28 = [
        ["\u03BF\u03C5\u03B4\u03C9\u03BD", -1, 1],
        ["\u03BF\u03C5\u03B4\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_29 = [
        ["\u03C4\u03C1\u03B1\u03B3", -1, 1],
        ["\u03C6\u03B5", -1, 1],
        ["\u03BA\u03B1\u03BB\u03B9\u03B1\u03BA", -1, 1],
        ["\u03B1\u03C1\u03BA", -1, 1],
        ["\u03C3\u03BA", -1, 1],
        ["\u03C0\u03B5\u03C4\u03B1\u03BB", -1, 1],
        ["\u03B2\u03B5\u03BB", -1, 1],
        ["\u03BB\u03BF\u03C5\u03BB", -1, 1],
        ["\u03C6\u03BB", -1, 1],
        ["\u03C7\u03BD", -1, 1],
        ["\u03C0\u03BB\u03B5\u03BE", -1, 1],
        ["\u03C3\u03C0", -1, 1],
        ["\u03C6\u03C1", -1, 1],
        ["\u03C3", -1, 1],
        ["\u03BB\u03B9\u03C7", -1, 1]
    ];

    /** @const */ var a_30 = [
        ["\u03B5\u03C9\u03BD", -1, 1],
        ["\u03B5\u03C9\u03C3", -1, 1]
    ];

    /** @const */ var a_31 = [
        ["\u03B4", -1, 1],
        ["\u03B9\u03B4", 0, 1],
        ["\u03B8", -1, 1],
        ["\u03B3\u03B1\u03BB", -1, 1],
        ["\u03B5\u03BB", -1, 1],
        ["\u03BD", -1, 1],
        ["\u03C0", -1, 1],
        ["\u03C0\u03B1\u03C1", -1, 1]
    ];

    /** @const */ var a_32 = [
        ["\u03B9\u03B1", -1, 1],
        ["\u03B9\u03C9\u03BD", -1, 1],
        ["\u03B9\u03BF\u03C5", -1, 1]
    ];

    /** @const */ var a_33 = [
        ["\u03B9\u03BA\u03B1", -1, 1],
        ["\u03B9\u03BA\u03C9\u03BD", -1, 1],
        ["\u03B9\u03BA\u03BF", -1, 1],
        ["\u03B9\u03BA\u03BF\u03C5", -1, 1]
    ];

    /** @const */ var a_34 = [
        ["\u03B1\u03B4", -1, 1],
        ["\u03C3\u03C5\u03BD\u03B1\u03B4", 0, 1],
        ["\u03BA\u03B1\u03C4\u03B1\u03B4", 0, 1],
        ["\u03B1\u03BD\u03C4\u03B9\u03B4", -1, 1],
        ["\u03B5\u03BD\u03B4", -1, 1],
        ["\u03C6\u03C5\u03BB\u03BF\u03B4", -1, 1],
        ["\u03C5\u03C0\u03BF\u03B4", -1, 1],
        ["\u03C0\u03C1\u03C9\u03C4\u03BF\u03B4", -1, 1],
        ["\u03B5\u03BE\u03C9\u03B4", -1, 1],
        ["\u03B7\u03B8", -1, 1],
        ["\u03B1\u03BD\u03B7\u03B8", 9, 1],
        ["\u03BE\u03B9\u03BA", -1, 1],
        ["\u03B1\u03BB", -1, 1],
        ["\u03B1\u03BC\u03BC\u03BF\u03C7\u03B1\u03BB", 12, 1],
        ["\u03C3\u03C5\u03BD\u03BF\u03BC\u03B7\u03BB", -1, 1],
        ["\u03BC\u03C0\u03BF\u03BB", -1, 1],
        ["\u03BC\u03BF\u03C5\u03BB", -1, 1],
        ["\u03C4\u03C3\u03B1\u03BC", -1, 1],
        ["\u03B2\u03C1\u03C9\u03BC", -1, 1],
        ["\u03B1\u03BC\u03B1\u03BD", -1, 1],
        ["\u03BC\u03C0\u03B1\u03BD", -1, 1],
        ["\u03BA\u03B1\u03BB\u03BB\u03B9\u03BD", -1, 1],
        ["\u03C0\u03BF\u03C3\u03C4\u03B5\u03BB\u03BD", -1, 1],
        ["\u03C6\u03B9\u03BB\u03BF\u03BD", -1, 1],
        ["\u03BA\u03B1\u03BB\u03C0", -1, 1],
        ["\u03B3\u03B5\u03C1", -1, 1],
        ["\u03C7\u03B1\u03C3", -1, 1],
        ["\u03BC\u03C0\u03BF\u03C3", -1, 1],
        ["\u03C0\u03BB\u03B9\u03B1\u03C4\u03C3", -1, 1],
        ["\u03C0\u03B5\u03C4\u03C3", -1, 1],
        ["\u03C0\u03B9\u03C4\u03C3", -1, 1],
        ["\u03C6\u03C5\u03C3", -1, 1],
        ["\u03BC\u03C0\u03B1\u03B3\u03B9\u03B1\u03C4", -1, 1],
        ["\u03BD\u03B9\u03C4", -1, 1],
        ["\u03C0\u03B9\u03BA\u03B1\u03BD\u03C4", -1, 1],
        ["\u03C3\u03B5\u03C1\u03C4", -1, 1]
    ];

    /** @const */ var a_35 = [
        ["\u03B1\u03B3\u03B1\u03BC\u03B5", -1, 1],
        ["\u03B7\u03BA\u03B1\u03BC\u03B5", -1, 1],
        ["\u03B7\u03B8\u03B7\u03BA\u03B1\u03BC\u03B5", 1, 1],
        ["\u03B7\u03C3\u03B1\u03BC\u03B5", -1, 1],
        ["\u03BF\u03C5\u03C3\u03B1\u03BC\u03B5", -1, 1]
    ];

    /** @const */ var a_36 = [
        ["\u03B2\u03BF\u03C5\u03B2", -1, 1],
        ["\u03BE\u03B5\u03B8", -1, 1],
        ["\u03C0\u03B5\u03B8", -1, 1],
        ["\u03B1\u03C0\u03BF\u03B8", -1, 1],
        ["\u03B1\u03C0\u03BF\u03BA", -1, 1],
        ["\u03BF\u03C5\u03BB", -1, 1],
        ["\u03B1\u03BD\u03B1\u03C0", -1, 1],
        ["\u03C0\u03B9\u03BA\u03C1", -1, 1],
        ["\u03C0\u03BF\u03C4", -1, 1],
        ["\u03B1\u03C0\u03BF\u03C3\u03C4", -1, 1],
        ["\u03C7", -1, 1],
        ["\u03C3\u03B9\u03C7", 10, 1]
    ];

    /** @const */ var a_37 = [
        ["\u03C4\u03C1", -1, 1],
        ["\u03C4\u03C3", -1, 1]
    ];

    /** @const */ var a_38 = [
        ["\u03B1\u03B3\u03B1\u03BD\u03B5", -1, 1],
        ["\u03B7\u03BA\u03B1\u03BD\u03B5", -1, 1],
        ["\u03B7\u03B8\u03B7\u03BA\u03B1\u03BD\u03B5", 1, 1],
        ["\u03B7\u03C3\u03B1\u03BD\u03B5", -1, 1],
        ["\u03BF\u03C5\u03C3\u03B1\u03BD\u03B5", -1, 1],
        ["\u03BF\u03BD\u03C4\u03B1\u03BD\u03B5", -1, 1],
        ["\u03B9\u03BF\u03BD\u03C4\u03B1\u03BD\u03B5", 5, 1],
        ["\u03BF\u03C5\u03BD\u03C4\u03B1\u03BD\u03B5", -1, 1],
        ["\u03B9\u03BF\u03C5\u03BD\u03C4\u03B1\u03BD\u03B5", 7, 1],
        ["\u03BF\u03C4\u03B1\u03BD\u03B5", -1, 1],
        ["\u03B9\u03BF\u03C4\u03B1\u03BD\u03B5", 9, 1]
    ];

    /** @const */ var a_39 = [
        ["\u03C4\u03B1\u03B2", -1, 1],
        ["\u03BD\u03C4\u03B1\u03B2", 0, 1],
        ["\u03C8\u03B7\u03BB\u03BF\u03C4\u03B1\u03B2", 0, 1],
        ["\u03BB\u03B9\u03B2", -1, 1],
        ["\u03BA\u03BB\u03B9\u03B2", 3, 1],
        ["\u03BE\u03B7\u03C1\u03BF\u03BA\u03BB\u03B9\u03B2", 4, 1],
        ["\u03B3", -1, 1],
        ["\u03B1\u03B3", 6, 1],
        ["\u03C4\u03C1\u03B1\u03B3", 7, 1],
        ["\u03C4\u03C3\u03B1\u03B3", 7, 1],
        ["\u03B1\u03B8\u03B9\u03B3\u03B3", 6, 1],
        ["\u03C4\u03C3\u03B9\u03B3\u03B3", 6, 1],
        ["\u03B1\u03C4\u03C3\u03B9\u03B3\u03B3", 11, 1],
        ["\u03C3\u03C4\u03B5\u03B3", 6, 1],
        ["\u03B1\u03C0\u03B7\u03B3", 6, 1],
        ["\u03C3\u03B9\u03B3", 6, 1],
        ["\u03B1\u03BD\u03BF\u03C1\u03B3", 6, 1],
        ["\u03B5\u03BD\u03BF\u03C1\u03B3", 6, 1],
        ["\u03BA\u03B1\u03BB\u03C0\u03BF\u03C5\u03B6", -1, 1],
        ["\u03B8", -1, 1],
        ["\u03BC\u03C9\u03B1\u03BC\u03B5\u03B8", 19, 1],
        ["\u03C0\u03B9\u03B8", 19, 1],
        ["\u03B1\u03C0\u03B9\u03B8", 21, 1],
        ["\u03B4\u03B5\u03BA", -1, 1],
        ["\u03C0\u03B5\u03BB\u03B5\u03BA", -1, 1],
        ["\u03B9\u03BA", -1, 1],
        ["\u03B1\u03BD\u03B9\u03BA", 25, 1],
        ["\u03B2\u03BF\u03C5\u03BB\u03BA", -1, 1],
        ["\u03B2\u03B1\u03C3\u03BA", -1, 1],
        ["\u03B2\u03C1\u03B1\u03C7\u03C5\u03BA", -1, 1],
        ["\u03B3\u03B1\u03BB", -1, 1],
        ["\u03BA\u03B1\u03C4\u03B1\u03B3\u03B1\u03BB", 30, 1],
        ["\u03BF\u03BB\u03BF\u03B3\u03B1\u03BB", 30, 1],
        ["\u03B2\u03B1\u03B8\u03C5\u03B3\u03B1\u03BB", 30, 1],
        ["\u03BC\u03B5\u03BB", -1, 1],
        ["\u03BA\u03B1\u03C3\u03C4\u03B5\u03BB", -1, 1],
        ["\u03C0\u03BF\u03C1\u03C4\u03BF\u03BB", -1, 1],
        ["\u03C0\u03BB", -1, 1],
        ["\u03B4\u03B9\u03C0\u03BB", 37, 1],
        ["\u03BB\u03B1\u03BF\u03C0\u03BB", 37, 1],
        ["\u03C8\u03C5\u03C7\u03BF\u03C0\u03BB", 37, 1],
        ["\u03BF\u03C5\u03BB", -1, 1],
        ["\u03BC", -1, 1],
        ["\u03BF\u03BB\u03B9\u03B3\u03BF\u03B4\u03B1\u03BC", 42, 1],
        ["\u03BC\u03BF\u03C5\u03C3\u03BF\u03C5\u03BB\u03BC", 42, 1],
        ["\u03B4\u03C1\u03B1\u03B4\u03BF\u03C5\u03BC", 42, 1],
        ["\u03B2\u03C1\u03B1\u03C7\u03BC", 42, 1],
        ["\u03BD", -1, 1],
        ["\u03B1\u03BC\u03B5\u03C1\u03B9\u03BA\u03B1\u03BD", 47, 1],
        ["\u03C0", -1, 1],
        ["\u03B1\u03B4\u03B1\u03C0", 49, 1],
        ["\u03C7\u03B1\u03BC\u03B7\u03BB\u03BF\u03B4\u03B1\u03C0", 49, 1],
        ["\u03C0\u03BF\u03BB\u03C5\u03B4\u03B1\u03C0", 49, 1],
        ["\u03BA\u03BF\u03C0", 49, 1],
        ["\u03C5\u03C0\u03BF\u03BA\u03BF\u03C0", 53, 1],
        ["\u03C4\u03C3\u03BF\u03C0", 49, 1],
        ["\u03C3\u03C0", 49, 1],
        ["\u03B5\u03C1", -1, 1],
        ["\u03B3\u03B5\u03C1", 57, 1],
        ["\u03B2\u03B5\u03C4\u03B5\u03C1", 57, 1],
        ["\u03BB\u03BF\u03C5\u03B8\u03B7\u03C1", -1, 1],
        ["\u03BA\u03BF\u03C1\u03BC\u03BF\u03C1", -1, 1],
        ["\u03C0\u03B5\u03C1\u03B9\u03C4\u03C1", -1, 1],
        ["\u03BF\u03C5\u03C1", -1, 1],
        ["\u03C3", -1, 1],
        ["\u03B2\u03B1\u03C3", 64, 1],
        ["\u03C0\u03BF\u03BB\u03B9\u03C3", 64, 1],
        ["\u03C3\u03B1\u03C1\u03B1\u03BA\u03B1\u03C4\u03C3", 64, 1],
        ["\u03B8\u03C5\u03C3", 64, 1],
        ["\u03B4\u03B9\u03B1\u03C4", -1, 1],
        ["\u03C0\u03BB\u03B1\u03C4", -1, 1],
        ["\u03C4\u03C3\u03B1\u03C1\u03BB\u03B1\u03C4", -1, 1],
        ["\u03C4\u03B5\u03C4", -1, 1],
        ["\u03C0\u03BF\u03C5\u03C1\u03B9\u03C4", -1, 1],
        ["\u03C3\u03BF\u03C5\u03BB\u03C4", -1, 1],
        ["\u03BC\u03B1\u03B9\u03BD\u03C4", -1, 1],
        ["\u03B6\u03C9\u03BD\u03C4", -1, 1],
        ["\u03BA\u03B1\u03C3\u03C4", -1, 1],
        ["\u03C6", -1, 1],
        ["\u03B4\u03B9\u03B1\u03C6", 78, 1],
        ["\u03C3\u03C4\u03B5\u03C6", 78, 1],
        ["\u03C6\u03C9\u03C4\u03BF\u03C3\u03C4\u03B5\u03C6", 80, 1],
        ["\u03C0\u03B5\u03C1\u03B7\u03C6", 78, 1],
        ["\u03C5\u03C0\u03B5\u03C1\u03B7\u03C6", 82, 1],
        ["\u03BA\u03BF\u03B9\u03BB\u03B1\u03C1\u03C6", 78, 1],
        ["\u03C0\u03B5\u03BD\u03C4\u03B1\u03C1\u03C6", 78, 1],
        ["\u03BF\u03C1\u03C6", 78, 1],
        ["\u03C7", -1, 1],
        ["\u03B1\u03BC\u03B7\u03C7", 87, 1],
        ["\u03B2\u03B9\u03BF\u03BC\u03B7\u03C7", 87, 1],
        ["\u03BC\u03B5\u03B3\u03BB\u03BF\u03B2\u03B9\u03BF\u03BC\u03B7\u03C7", 89, 1],
        ["\u03BA\u03B1\u03C0\u03BD\u03BF\u03B2\u03B9\u03BF\u03BC\u03B7\u03C7", 89, 1],
        ["\u03BC\u03B9\u03BA\u03C1\u03BF\u03B2\u03B9\u03BF\u03BC\u03B7\u03C7", 89, 1],
        ["\u03C0\u03BF\u03BB\u03C5\u03BC\u03B7\u03C7", 87, 1],
        ["\u03BB\u03B9\u03C7", 87, 1]
    ];

    /** @const */ var a_40 = [
        ["\u03B7\u03C3\u03B5\u03C4\u03B5", -1, 1]
    ];

    /** @const */ var a_41 = [
        ["\u03B5\u03BD\u03B4", -1, 1],
        ["\u03C3\u03C5\u03BD\u03B4", -1, 1],
        ["\u03BF\u03B4", -1, 1],
        ["\u03B4\u03B9\u03B1\u03B8", -1, 1],
        ["\u03BA\u03B1\u03B8", -1, 1],
        ["\u03C1\u03B1\u03B8", -1, 1],
        ["\u03C4\u03B1\u03B8", -1, 1],
        ["\u03C4\u03B9\u03B8", -1, 1],
        ["\u03B5\u03BA\u03B8", -1, 1],
        ["\u03B5\u03BD\u03B8", -1, 1],
        ["\u03C3\u03C5\u03BD\u03B8", -1, 1],
        ["\u03C1\u03BF\u03B8", -1, 1],
        ["\u03C5\u03C0\u03B5\u03C1\u03B8", -1, 1],
        ["\u03C3\u03B8", -1, 1],
        ["\u03B5\u03C5\u03B8", -1, 1],
        ["\u03B1\u03C1\u03BA", -1, 1],
        ["\u03C9\u03C6\u03B5\u03BB", -1, 1],
        ["\u03B2\u03BF\u03BB", -1, 1],
        ["\u03B1\u03B9\u03BD", -1, 1],
        ["\u03C0\u03BF\u03BD", -1, 1],
        ["\u03C1\u03BF\u03BD", -1, 1],
        ["\u03C3\u03C5\u03BD", -1, 1],
        ["\u03B2\u03B1\u03C1", -1, 1],
        ["\u03B2\u03C1", -1, 1],
        ["\u03B1\u03B9\u03C1", -1, 1],
        ["\u03C6\u03BF\u03C1", -1, 1],
        ["\u03B5\u03C5\u03C1", -1, 1],
        ["\u03C0\u03C5\u03C1", -1, 1],
        ["\u03C7\u03C9\u03C1", -1, 1],
        ["\u03BD\u03B5\u03C4", -1, 1],
        ["\u03C3\u03C7", -1, 1]
    ];

    /** @const */ var a_42 = [
        ["\u03C0\u03B1\u03B3", -1, 1],
        ["\u03B4", -1, 1],
        ["\u03B1\u03B4", 1, 1],
        ["\u03B8", -1, 1],
        ["\u03B1\u03B8", 3, 1],
        ["\u03C4\u03BF\u03BA", -1, 1],
        ["\u03C3\u03BA", -1, 1],
        ["\u03C0\u03B1\u03C1\u03B1\u03BA\u03B1\u03BB", -1, 1],
        ["\u03C3\u03BA\u03B5\u03BB", -1, 1],
        ["\u03B1\u03C0\u03BB", -1, 1],
        ["\u03B5\u03BC", -1, 1],
        ["\u03B1\u03BD", -1, 1],
        ["\u03B2\u03B5\u03BD", -1, 1],
        ["\u03B2\u03B1\u03C1\u03BF\u03BD", -1, 1],
        ["\u03BA\u03BF\u03C0", -1, 1],
        ["\u03C3\u03B5\u03C1\u03C0", -1, 1],
        ["\u03B1\u03B2\u03B1\u03C1", -1, 1],
        ["\u03B5\u03BD\u03B1\u03C1", -1, 1],
        ["\u03B1\u03B2\u03C1", -1, 1],
        ["\u03BC\u03C0\u03BF\u03C1", -1, 1],
        ["\u03B8\u03B1\u03C1\u03C1", -1, 1],
        ["\u03BD\u03C4\u03C1", -1, 1],
        ["\u03C5", -1, 1],
        ["\u03BD\u03B9\u03C6", -1, 1],
        ["\u03C3\u03C5\u03C1\u03C6", -1, 1]
    ];

    /** @const */ var a_43 = [
        ["\u03BF\u03BD\u03C4\u03B1\u03C3", -1, 1],
        ["\u03C9\u03BD\u03C4\u03B1\u03C3", -1, 1]
    ];

    /** @const */ var a_44 = [
        ["\u03BF\u03BC\u03B1\u03C3\u03C4\u03B5", -1, 1],
        ["\u03B9\u03BF\u03BC\u03B1\u03C3\u03C4\u03B5", 0, 1]
    ];

    /** @const */ var a_45 = [
        ["\u03C0", -1, 1],
        ["\u03B1\u03C0", 0, 1],
        ["\u03B1\u03BA\u03B1\u03C4\u03B1\u03C0", 1, 1],
        ["\u03C3\u03C5\u03BC\u03C0", 0, 1],
        ["\u03B1\u03C3\u03C5\u03BC\u03C0", 3, 1],
        ["\u03B1\u03BC\u03B5\u03C4\u03B1\u03BC\u03C6", -1, 1]
    ];

    /** @const */ var a_46 = [
        ["\u03B6", -1, 1],
        ["\u03B1\u03BB", -1, 1],
        ["\u03C0\u03B1\u03C1\u03B1\u03BA\u03B1\u03BB", 1, 1],
        ["\u03B5\u03BA\u03C4\u03B5\u03BB", -1, 1],
        ["\u03BC", -1, 1],
        ["\u03BE", -1, 1],
        ["\u03C0\u03C1\u03BF", -1, 1],
        ["\u03B1\u03C1", -1, 1],
        ["\u03BD\u03B9\u03C3", -1, 1]
    ];

    /** @const */ var a_47 = [
        ["\u03B7\u03B8\u03B7\u03BA\u03B1", -1, 1],
        ["\u03B7\u03B8\u03B7\u03BA\u03B5", -1, 1],
        ["\u03B7\u03B8\u03B7\u03BA\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_48 = [
        ["\u03C0\u03B9\u03B8", -1, 1],
        ["\u03BF\u03B8", -1, 1],
        ["\u03BD\u03B1\u03C1\u03B8", -1, 1],
        ["\u03C3\u03BA\u03BF\u03C5\u03BB", -1, 1],
        ["\u03C3\u03BA\u03C9\u03BB", -1, 1],
        ["\u03C3\u03C6", -1, 1]
    ];

    /** @const */ var a_49 = [
        ["\u03B8", -1, 1],
        ["\u03B4\u03B9\u03B1\u03B8", 0, 1],
        ["\u03C0\u03B1\u03C1\u03B1\u03BA\u03B1\u03C4\u03B1\u03B8", 0, 1],
        ["\u03C3\u03C5\u03BD\u03B8", 0, 1],
        ["\u03C0\u03C1\u03BF\u03C3\u03B8", 0, 1]
    ];

    /** @const */ var a_50 = [
        ["\u03B7\u03BA\u03B1", -1, 1],
        ["\u03B7\u03BA\u03B5", -1, 1],
        ["\u03B7\u03BA\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_51 = [
        ["\u03C6\u03B1\u03B3", -1, 1],
        ["\u03BB\u03B7\u03B3", -1, 1],
        ["\u03C6\u03C1\u03C5\u03B4", -1, 1],
        ["\u03BC\u03B1\u03BD\u03C4\u03B9\u03BB", -1, 1],
        ["\u03BC\u03B1\u03BB\u03BB", -1, 1],
        ["\u03BF\u03BC", -1, 1],
        ["\u03B2\u03BB\u03B5\u03C0", -1, 1],
        ["\u03C0\u03BF\u03B4\u03B1\u03C1", -1, 1],
        ["\u03BA\u03C5\u03BC\u03B1\u03C4", -1, 1],
        ["\u03C0\u03C1\u03C9\u03C4", -1, 1],
        ["\u03BB\u03B1\u03C7", -1, 1],
        ["\u03C0\u03B1\u03BD\u03C4\u03B1\u03C7", -1, 1]
    ];

    /** @const */ var a_52 = [
        ["\u03C4\u03C3\u03B1", -1, 1],
        ["\u03C7\u03B1\u03B4", -1, 1],
        ["\u03BC\u03B5\u03B4", -1, 1],
        ["\u03BB\u03B1\u03BC\u03C0\u03B9\u03B4", -1, 1],
        ["\u03B4\u03B5", -1, 1],
        ["\u03C0\u03BB\u03B5", -1, 1],
        ["\u03BC\u03B5\u03C3\u03B1\u03B6", -1, 1],
        ["\u03B4\u03B5\u03C3\u03C0\u03BF\u03B6", -1, 1],
        ["\u03B1\u03B9\u03B8", -1, 1],
        ["\u03C6\u03B1\u03C1\u03BC\u03B1\u03BA", -1, 1],
        ["\u03B1\u03B3\u03BA", -1, 1],
        ["\u03B1\u03BD\u03B7\u03BA", -1, 1],
        ["\u03BB", -1, 1],
        ["\u03BC", -1, 1],
        ["\u03B1\u03BC", 13, 1],
        ["\u03B2\u03C1\u03BF\u03BC", 13, 1],
        ["\u03C5\u03C0\u03BF\u03C4\u03B5\u03B9\u03BD", -1, 1],
        ["\u03B5\u03BA\u03BB\u03B9\u03C0", -1, 1],
        ["\u03C1", -1, 1],
        ["\u03B5\u03BD\u03B4\u03B9\u03B1\u03C6\u03B5\u03C1", 18, 1],
        ["\u03B1\u03BD\u03B1\u03C1\u03C1", 18, 1],
        ["\u03C0\u03B1\u03C4", -1, 1],
        ["\u03BA\u03B1\u03B8\u03B1\u03C1\u03B5\u03C5", -1, 1],
        ["\u03B4\u03B5\u03C5\u03C4\u03B5\u03C1\u03B5\u03C5", -1, 1],
        ["\u03BB\u03B5\u03C7", -1, 1]
    ];

    /** @const */ var a_53 = [
        ["\u03BF\u03C5\u03C3\u03B1", -1, 1],
        ["\u03BF\u03C5\u03C3\u03B5", -1, 1],
        ["\u03BF\u03C5\u03C3\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_54 = [
        ["\u03C0\u03B5\u03BB", -1, 1],
        ["\u03BB\u03BB", -1, 1],
        ["\u03C3\u03BC\u03B7\u03BD", -1, 1],
        ["\u03C1\u03C0", -1, 1],
        ["\u03C0\u03C1", -1, 1],
        ["\u03C6\u03C1", -1, 1],
        ["\u03C7\u03BF\u03C1\u03C4", -1, 1],
        ["\u03BF\u03C6", -1, 1],
        ["\u03C8\u03BF\u03C6", 7, -1],
        ["\u03C3\u03C6", -1, 1],
        ["\u03BB\u03BF\u03C7", -1, 1],
        ["\u03BD\u03B1\u03C5\u03BB\u03BF\u03C7", 10, -1]
    ];

    /** @const */ var a_55 = [
        ["\u03B1\u03BC\u03B1\u03BB\u03BB\u03B9", -1, 1],
        ["\u03BB", -1, 1],
        ["\u03B1\u03BC\u03B1\u03BB", 1, 1],
        ["\u03BC", -1, 1],
        ["\u03BF\u03C5\u03BB\u03B1\u03BC", 3, 1],
        ["\u03B5\u03BD", -1, 1],
        ["\u03B4\u03B5\u03C1\u03B2\u03B5\u03BD", 5, 1],
        ["\u03C0", -1, 1],
        ["\u03B1\u03B5\u03B9\u03C0", 7, 1],
        ["\u03B1\u03C1\u03C4\u03B9\u03C0", 7, 1],
        ["\u03C3\u03C5\u03BC\u03C0", 7, 1],
        ["\u03BD\u03B5\u03BF\u03C0", 7, 1],
        ["\u03BA\u03C1\u03BF\u03BA\u03B1\u03BB\u03BF\u03C0", 7, 1],
        ["\u03BF\u03BB\u03BF\u03C0", 7, 1],
        ["\u03C0\u03C1\u03BF\u03C3\u03C9\u03C0\u03BF\u03C0", 7, 1],
        ["\u03C3\u03B9\u03B4\u03B7\u03C1\u03BF\u03C0", 7, 1],
        ["\u03B4\u03C1\u03BF\u03C3\u03BF\u03C0", 7, 1],
        ["\u03B1\u03C3\u03C0", 7, 1],
        ["\u03B1\u03BD\u03C5\u03C0", 7, 1],
        ["\u03C1", -1, 1],
        ["\u03B1\u03C3\u03C0\u03B1\u03C1", 19, 1],
        ["\u03C7\u03B1\u03C1", 19, 1],
        ["\u03B1\u03C7\u03B1\u03C1", 21, 1],
        ["\u03B1\u03C0\u03B5\u03C1", 19, 1],
        ["\u03C4\u03C1", 19, 1],
        ["\u03BF\u03C5\u03C1", 19, 1],
        ["\u03C4", -1, 1],
        ["\u03B4\u03B9\u03B1\u03C4", 26, 1],
        ["\u03B5\u03C0\u03B9\u03C4", 26, 1],
        ["\u03C3\u03C5\u03BD\u03C4", 26, 1],
        ["\u03BF\u03BC\u03BF\u03C4", 26, 1],
        ["\u03BD\u03BF\u03BC\u03BF\u03C4", 30, 1],
        ["\u03B1\u03C0\u03BF\u03C4", 26, 1],
        ["\u03C5\u03C0\u03BF\u03C4", 26, 1],
        ["\u03B1\u03B2\u03B1\u03C3\u03C4", 26, 1],
        ["\u03B1\u03B9\u03BC\u03BF\u03C3\u03C4", 26, 1],
        ["\u03C0\u03C1\u03BF\u03C3\u03C4", 26, 1],
        ["\u03B1\u03BD\u03C5\u03C3\u03C4", 26, 1],
        ["\u03BD\u03B1\u03C5", -1, 1],
        ["\u03B1\u03C6", -1, 1],
        ["\u03BE\u03B5\u03C6", -1, 1],
        ["\u03B1\u03B4\u03B7\u03C6", -1, 1],
        ["\u03C0\u03B1\u03BC\u03C6", -1, 1],
        ["\u03C0\u03BF\u03BB\u03C5\u03C6", -1, 1]
    ];

    /** @const */ var a_56 = [
        ["\u03B1\u03B3\u03B1", -1, 1],
        ["\u03B1\u03B3\u03B5", -1, 1],
        ["\u03B1\u03B3\u03B5\u03C3", -1, 1]
    ];

    /** @const */ var a_57 = [
        ["\u03B7\u03C3\u03B1", -1, 1],
        ["\u03B7\u03C3\u03B5", -1, 1],
        ["\u03B7\u03C3\u03BF\u03C5", -1, 1]
    ];

    /** @const */ var a_58 = [
        ["\u03BD", -1, 1],
        ["\u03B4\u03C9\u03B4\u03B5\u03BA\u03B1\u03BD", 0, 1],
        ["\u03B5\u03C0\u03C4\u03B1\u03BD", 0, 1],
        ["\u03BC\u03B5\u03B3\u03B1\u03BB\u03BF\u03BD", 0, 1],
        ["\u03B5\u03C1\u03B7\u03BC\u03BF\u03BD", 0, 1],
        ["\u03C7\u03B5\u03C1\u03C3\u03BF\u03BD", 0, 1]
    ];

    /** @const */ var a_59 = [
        ["\u03B7\u03C3\u03C4\u03B5", -1, 1]
    ];

    /** @const */ var a_60 = [
        ["\u03C3\u03B2", -1, 1],
        ["\u03B1\u03C3\u03B2", 0, 1],
        ["\u03B1\u03C0\u03BB", -1, 1],
        ["\u03B1\u03B5\u03B9\u03BC\u03BD", -1, 1],
        ["\u03C7\u03C1", -1, 1],
        ["\u03B1\u03C7\u03C1", 4, 1],
        ["\u03BA\u03BF\u03B9\u03BD\u03BF\u03C7\u03C1", 4, 1],
        ["\u03B4\u03C5\u03C3\u03C7\u03C1", 4, 1],
        ["\u03B5\u03C5\u03C7\u03C1", 4, 1],
        ["\u03C0\u03B1\u03BB\u03B9\u03BC\u03C8", -1, 1]
    ];

    /** @const */ var a_61 = [
        ["\u03BF\u03C5\u03BD\u03B5", -1, 1],
        ["\u03B7\u03B8\u03BF\u03C5\u03BD\u03B5", 0, 1],
        ["\u03B7\u03C3\u03BF\u03C5\u03BD\u03B5", 0, 1]
    ];

    /** @const */ var a_62 = [
        ["\u03C3\u03C0\u03B9", -1, 1],
        ["\u03BD", -1, 1],
        ["\u03B5\u03BE\u03C9\u03BD", 1, 1],
        ["\u03C1", -1, 1],
        ["\u03C3\u03C4\u03C1\u03B1\u03B2\u03BF\u03BC\u03BF\u03C5\u03C4\u03C3", -1, 1],
        ["\u03BA\u03B1\u03BA\u03BF\u03BC\u03BF\u03C5\u03C4\u03C3", -1, 1]
    ];

    /** @const */ var a_63 = [
        ["\u03BF\u03C5\u03BC\u03B5", -1, 1],
        ["\u03B7\u03B8\u03BF\u03C5\u03BC\u03B5", 0, 1],
        ["\u03B7\u03C3\u03BF\u03C5\u03BC\u03B5", 0, 1]
    ];

    /** @const */ var a_64 = [
        ["\u03B1\u03B6", -1, 1],
        ["\u03C9\u03C1\u03B9\u03BF\u03C0\u03BB", -1, 1],
        ["\u03B1\u03C3\u03BF\u03C5\u03C3", -1, 1],
        ["\u03C0\u03B1\u03C1\u03B1\u03C3\u03BF\u03C5\u03C3", 2, 1],
        ["\u03B1\u03BB\u03BB\u03BF\u03C3\u03BF\u03C5\u03C3", -1, 1],
        ["\u03C6", -1, 1],
        ["\u03C7", -1, 1]
    ];

    /** @const */ var a_65 = [
        ["\u03BC\u03B1\u03C4\u03B1", -1, 1],
        ["\u03BC\u03B1\u03C4\u03C9\u03BD", -1, 1],
        ["\u03BC\u03B1\u03C4\u03BF\u03C3", -1, 1]
    ];

    /** @const */ var a_66 = [
        ["\u03B1", -1, 1],
        ["\u03B9\u03BF\u03C5\u03BC\u03B1", 0, 1],
        ["\u03BF\u03BC\u03BF\u03C5\u03BD\u03B1", 0, 1],
        ["\u03B9\u03BF\u03BC\u03BF\u03C5\u03BD\u03B1", 2, 1],
        ["\u03BF\u03C3\u03BF\u03C5\u03BD\u03B1", 0, 1],
        ["\u03B9\u03BF\u03C3\u03BF\u03C5\u03BD\u03B1", 4, 1],
        ["\u03B5", -1, 1],
        ["\u03B1\u03B3\u03B1\u03C4\u03B5", 6, 1],
        ["\u03B7\u03BA\u03B1\u03C4\u03B5", 6, 1],
        ["\u03B7\u03B8\u03B7\u03BA\u03B1\u03C4\u03B5", 8, 1],
        ["\u03B7\u03C3\u03B1\u03C4\u03B5", 6, 1],
        ["\u03BF\u03C5\u03C3\u03B1\u03C4\u03B5", 6, 1],
        ["\u03B5\u03B9\u03C4\u03B5", 6, 1],
        ["\u03B7\u03B8\u03B5\u03B9\u03C4\u03B5", 12, 1],
        ["\u03B9\u03B5\u03BC\u03B1\u03C3\u03C4\u03B5", 6, 1],
        ["\u03BF\u03C5\u03BC\u03B1\u03C3\u03C4\u03B5", 6, 1],
        ["\u03B9\u03BF\u03C5\u03BC\u03B1\u03C3\u03C4\u03B5", 15, 1],
        ["\u03B9\u03B5\u03C3\u03B1\u03C3\u03C4\u03B5", 6, 1],
        ["\u03BF\u03C3\u03B1\u03C3\u03C4\u03B5", 6, 1],
        ["\u03B9\u03BF\u03C3\u03B1\u03C3\u03C4\u03B5", 18, 1],
        ["\u03B7", -1, 1],
        ["\u03B9", -1, 1],
        ["\u03B1\u03BC\u03B1\u03B9", 21, 1],
        ["\u03B9\u03B5\u03BC\u03B1\u03B9", 21, 1],
        ["\u03BF\u03BC\u03B1\u03B9", 21, 1],
        ["\u03BF\u03C5\u03BC\u03B1\u03B9", 21, 1],
        ["\u03B1\u03C3\u03B1\u03B9", 21, 1],
        ["\u03B5\u03C3\u03B1\u03B9", 21, 1],
        ["\u03B9\u03B5\u03C3\u03B1\u03B9", 27, 1],
        ["\u03B1\u03C4\u03B1\u03B9", 21, 1],
        ["\u03B5\u03C4\u03B1\u03B9", 21, 1],
        ["\u03B9\u03B5\u03C4\u03B1\u03B9", 30, 1],
        ["\u03BF\u03BD\u03C4\u03B1\u03B9", 21, 1],
        ["\u03BF\u03C5\u03BD\u03C4\u03B1\u03B9", 21, 1],
        ["\u03B9\u03BF\u03C5\u03BD\u03C4\u03B1\u03B9", 33, 1],
        ["\u03B5\u03B9", 21, 1],
        ["\u03B1\u03B5\u03B9", 35, 1],
        ["\u03B7\u03B8\u03B5\u03B9", 35, 1],
        ["\u03B7\u03C3\u03B5\u03B9", 35, 1],
        ["\u03BF\u03B9", 21, 1],
        ["\u03B1\u03BD", -1, 1],
        ["\u03B1\u03B3\u03B1\u03BD", 40, 1],
        ["\u03B7\u03BA\u03B1\u03BD", 40, 1],
        ["\u03B7\u03B8\u03B7\u03BA\u03B1\u03BD", 42, 1],
        ["\u03B7\u03C3\u03B1\u03BD", 40, 1],
        ["\u03BF\u03C5\u03C3\u03B1\u03BD", 40, 1],
        ["\u03BF\u03BD\u03C4\u03BF\u03C5\u03C3\u03B1\u03BD", 45, 1],
        ["\u03B9\u03BF\u03BD\u03C4\u03BF\u03C5\u03C3\u03B1\u03BD", 46, 1],
        ["\u03BF\u03BD\u03C4\u03B1\u03BD", 40, 1],
        ["\u03B9\u03BF\u03BD\u03C4\u03B1\u03BD", 48, 1],
        ["\u03BF\u03C5\u03BD\u03C4\u03B1\u03BD", 40, 1],
        ["\u03B9\u03BF\u03C5\u03BD\u03C4\u03B1\u03BD", 50, 1],
        ["\u03BF\u03C4\u03B1\u03BD", 40, 1],
        ["\u03B9\u03BF\u03C4\u03B1\u03BD", 52, 1],
        ["\u03BF\u03BC\u03B1\u03C3\u03C4\u03B1\u03BD", 40, 1],
        ["\u03B9\u03BF\u03BC\u03B1\u03C3\u03C4\u03B1\u03BD", 54, 1],
        ["\u03BF\u03C3\u03B1\u03C3\u03C4\u03B1\u03BD", 40, 1],
        ["\u03B9\u03BF\u03C3\u03B1\u03C3\u03C4\u03B1\u03BD", 56, 1],
        ["\u03BF\u03C5\u03BD", -1, 1],
        ["\u03B7\u03B8\u03BF\u03C5\u03BD", 58, 1],
        ["\u03BF\u03BC\u03BF\u03C5\u03BD", 58, 1],
        ["\u03B9\u03BF\u03BC\u03BF\u03C5\u03BD", 60, 1],
        ["\u03B7\u03C3\u03BF\u03C5\u03BD", 58, 1],
        ["\u03BF\u03C3\u03BF\u03C5\u03BD", 58, 1],
        ["\u03B9\u03BF\u03C3\u03BF\u03C5\u03BD", 63, 1],
        ["\u03C9\u03BD", -1, 1],
        ["\u03B7\u03B4\u03C9\u03BD", 65, 1],
        ["\u03BF", -1, 1],
        ["\u03B1\u03C3", -1, 1],
        ["\u03B5\u03C3", -1, 1],
        ["\u03B7\u03B4\u03B5\u03C3", 69, 1],
        ["\u03B7\u03C3\u03B5\u03C3", 69, 1],
        ["\u03B7\u03C3", -1, 1],
        ["\u03B5\u03B9\u03C3", -1, 1],
        ["\u03B7\u03B8\u03B5\u03B9\u03C3", 73, 1],
        ["\u03BF\u03C3", -1, 1],
        ["\u03C5\u03C3", -1, 1],
        ["\u03BF\u03C5\u03C3", 76, 1],
        ["\u03C5", -1, 1],
        ["\u03BF\u03C5", 78, 1],
        ["\u03C9", -1, 1],
        ["\u03B1\u03C9", 80, 1],
        ["\u03B7\u03B8\u03C9", 80, 1],
        ["\u03B7\u03C3\u03C9", 80, 1]
    ];

    /** @const */ var a_67 = [
        ["\u03BF\u03C4\u03B5\u03C1", -1, 1],
        ["\u03B5\u03C3\u03C4\u03B5\u03C1", -1, 1],
        ["\u03C5\u03C4\u03B5\u03C1", -1, 1],
        ["\u03C9\u03C4\u03B5\u03C1", -1, 1],
        ["\u03BF\u03C4\u03B1\u03C4", -1, 1],
        ["\u03B5\u03C3\u03C4\u03B1\u03C4", -1, 1],
        ["\u03C5\u03C4\u03B1\u03C4", -1, 1],
        ["\u03C9\u03C4\u03B1\u03C4", -1, 1]
    ];

    /** @const */ var /** Array<int> */ g_v = [81, 65, 16, 1];

    /** @const */ var /** Array<int> */ g_v2 = [81, 65, 0, 1];

    var /** boolean */ B_test1 = false;


    /** @return {boolean} */
    function r_has_min_length() {
        if (!(base.current.length >= 3))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_tolower() {
        var /** number */ among_var;
        while(true)
        {
            var /** number */ v_1 = base.limit - base.cursor;
            lab0: {
                base.ket = base.cursor;
                among_var = base.find_among_b(a_0);
                if (among_var == 0)
                {
                    break lab0;
                }
                base.bra = base.cursor;
                switch (among_var) {
                    case 1:
                        if (!base.slice_from("\u03B1"))
                        {
                            return false;
                        }
                        break;
                    case 2:
                        if (!base.slice_from("\u03B2"))
                        {
                            return false;
                        }
                        break;
                    case 3:
                        if (!base.slice_from("\u03B3"))
                        {
                            return false;
                        }
                        break;
                    case 4:
                        if (!base.slice_from("\u03B4"))
                        {
                            return false;
                        }
                        break;
                    case 5:
                        if (!base.slice_from("\u03B5"))
                        {
                            return false;
                        }
                        break;
                    case 6:
                        if (!base.slice_from("\u03B6"))
                        {
                            return false;
                        }
                        break;
                    case 7:
                        if (!base.slice_from("\u03B7"))
                        {
                            return false;
                        }
                        break;
                    case 8:
                        if (!base.slice_from("\u03B8"))
                        {
                            return false;
                        }
                        break;
                    case 9:
                        if (!base.slice_from("\u03B9"))
                        {
                            return false;
                        }
                        break;
                    case 10:
                        if (!base.slice_from("\u03BA"))
                        {
                            return false;
                        }
                        break;
                    case 11:
                        if (!base.slice_from("\u03BB"))
                        {
                            return false;
                        }
                        break;
                    case 12:
                        if (!base.slice_from("\u03BC"))
                        {
                            return false;
                        }
                        break;
                    case 13:
                        if (!base.slice_from("\u03BD"))
                        {
                            return false;
                        }
                        break;
                    case 14:
                        if (!base.slice_from("\u03BE"))
                        {
                            return false;
                        }
                        break;
                    case 15:
                        if (!base.slice_from("\u03BF"))
                        {
                            return false;
                        }
                        break;
                    case 16:
                        if (!base.slice_from("\u03C0"))
                        {
                            return false;
                        }
                        break;
                    case 17:
                        if (!base.slice_from("\u03C1"))
                        {
                            return false;
                        }
                        break;
                    case 18:
                        if (!base.slice_from("\u03C3"))
                        {
                            return false;
                        }
                        break;
                    case 19:
                        if (!base.slice_from("\u03C4"))
                        {
                            return false;
                        }
                        break;
                    case 20:
                        if (!base.slice_from("\u03C5"))
                        {
                            return false;
                        }
                        break;
                    case 21:
                        if (!base.slice_from("\u03C6"))
                        {
                            return false;
                        }
                        break;
                    case 22:
                        if (!base.slice_from("\u03C7"))
                        {
                            return false;
                        }
                        break;
                    case 23:
                        if (!base.slice_from("\u03C8"))
                        {
                            return false;
                        }
                        break;
                    case 24:
                        if (!base.slice_from("\u03C9"))
                        {
                            return false;
                        }
                        break;
                    case 25:
                        if (base.cursor <= base.limit_backward)
                        {
                            break lab0;
                        }
                        base.cursor--;
                        break;
                }
                continue;
            }
            base.cursor = base.limit - v_1;
            break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step1() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_1);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!base.slice_from("\u03C6\u03B1"))
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("\u03C3\u03BA\u03B1"))
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_from("\u03BF\u03BB\u03BF"))
                {
                    return false;
                }
                break;
            case 4:
                if (!base.slice_from("\u03C3\u03BF"))
                {
                    return false;
                }
                break;
            case 5:
                if (!base.slice_from("\u03C4\u03B1\u03C4\u03BF"))
                {
                    return false;
                }
                break;
            case 6:
                if (!base.slice_from("\u03BA\u03C1\u03B5"))
                {
                    return false;
                }
                break;
            case 7:
                if (!base.slice_from("\u03C0\u03B5\u03C1"))
                {
                    return false;
                }
                break;
            case 8:
                if (!base.slice_from("\u03C4\u03B5\u03C1"))
                {
                    return false;
                }
                break;
            case 9:
                if (!base.slice_from("\u03C6\u03C9"))
                {
                    return false;
                }
                break;
            case 10:
                if (!base.slice_from("\u03BA\u03B1\u03B8\u03B5\u03C3\u03C4"))
                {
                    return false;
                }
                break;
            case 11:
                if (!base.slice_from("\u03B3\u03B5\u03B3\u03BF\u03BD"))
                {
                    return false;
                }
                break;
        }
        B_test1 = false;
        return true;
    };

    /** @return {boolean} */
    function r_steps1() {
        var /** number */ among_var;
        base.ket = base.cursor;
        if (base.find_among_b(a_3) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        among_var = base.find_among_b(a_2);
        if (among_var == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        switch (among_var) {
            case 1:
                if (!base.slice_from("\u03B9"))
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("\u03B9\u03B6"))
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_steps2() {
        base.ket = base.cursor;
        if (base.find_among_b(a_5) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_4) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03C9\u03BD"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_steps3() {
        var /** number */ among_var;
        base.ket = base.cursor;
        if (base.find_among_b(a_7) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                if (!(base.eq_s_b("\u03B9\u03C3\u03B1")))
                {
                    break lab1;
                }
                if (base.cursor > base.limit_backward)
                {
                    break lab1;
                }
                if (!base.slice_from("\u03B9\u03C3"))
                {
                    return false;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            base.ket = base.cursor;
            base.bra = base.cursor;
            among_var = base.find_among_b(a_6);
            if (among_var == 0)
            {
                return false;
            }
            if (base.cursor > base.limit_backward)
            {
                return false;
            }
            switch (among_var) {
                case 1:
                    if (!base.slice_from("\u03B9"))
                    {
                        return false;
                    }
                    break;
                case 2:
                    if (!base.slice_from("\u03B9\u03C3"))
                    {
                        return false;
                    }
                    break;
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_steps4() {
        base.ket = base.cursor;
        if (base.find_among_b(a_9) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_8) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B9"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_steps5() {
        var /** number */ among_var;
        base.ket = base.cursor;
        if (base.find_among_b(a_11) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        among_var = base.find_among_b(a_10);
        if (among_var == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        switch (among_var) {
            case 1:
                if (!base.slice_from("\u03B9"))
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("\u03B9\u03C3\u03C4"))
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_steps6() {
        var /** number */ among_var;
        base.ket = base.cursor;
        if (base.find_among_b(a_14) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                among_var = base.find_among_b(a_12);
                if (among_var == 0)
                {
                    break lab1;
                }
                if (base.cursor > base.limit_backward)
                {
                    break lab1;
                }
                switch (among_var) {
                    case 1:
                        if (!base.slice_from("\u03B9\u03C3\u03BC"))
                        {
                            return false;
                        }
                        break;
                    case 2:
                        if (!base.slice_from("\u03B9"))
                        {
                            return false;
                        }
                        break;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            base.ket = base.cursor;
            among_var = base.find_among_b(a_13);
            if (among_var == 0)
            {
                return false;
            }
            base.bra = base.cursor;
            switch (among_var) {
                case 1:
                    if (!base.slice_from("\u03B1\u03B3\u03BD\u03C9\u03C3\u03C4"))
                    {
                        return false;
                    }
                    break;
                case 2:
                    if (!base.slice_from("\u03B1\u03C4\u03BF\u03BC"))
                    {
                        return false;
                    }
                    break;
                case 3:
                    if (!base.slice_from("\u03B3\u03BD\u03C9\u03C3\u03C4"))
                    {
                        return false;
                    }
                    break;
                case 4:
                    if (!base.slice_from("\u03B5\u03B8\u03BD"))
                    {
                        return false;
                    }
                    break;
                case 5:
                    if (!base.slice_from("\u03B5\u03BA\u03BB\u03B5\u03BA\u03C4"))
                    {
                        return false;
                    }
                    break;
                case 6:
                    if (!base.slice_from("\u03C3\u03BA\u03B5\u03C0\u03C4"))
                    {
                        return false;
                    }
                    break;
                case 7:
                    if (!base.slice_from("\u03C4\u03BF\u03C0"))
                    {
                        return false;
                    }
                    break;
                case 8:
                    if (!base.slice_from("\u03B1\u03BB\u03B5\u03BE\u03B1\u03BD\u03B4\u03C1"))
                    {
                        return false;
                    }
                    break;
                case 9:
                    if (!base.slice_from("\u03B2\u03C5\u03B6\u03B1\u03BD\u03C4"))
                    {
                        return false;
                    }
                    break;
                case 10:
                    if (!base.slice_from("\u03B8\u03B5\u03B1\u03C4\u03C1"))
                    {
                        return false;
                    }
                    break;
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_steps7() {
        base.ket = base.cursor;
        if (base.find_among_b(a_16) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_15) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B1\u03C1\u03B1\u03BA"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_steps8() {
        var /** number */ among_var;
        base.ket = base.cursor;
        if (base.find_among_b(a_18) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                among_var = base.find_among_b(a_17);
                if (among_var == 0)
                {
                    break lab1;
                }
                if (base.cursor > base.limit_backward)
                {
                    break lab1;
                }
                switch (among_var) {
                    case 1:
                        if (!base.slice_from("\u03B1\u03BA"))
                        {
                            return false;
                        }
                        break;
                    case 2:
                        if (!base.slice_from("\u03B9\u03C4\u03C3"))
                        {
                            return false;
                        }
                        break;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            base.ket = base.cursor;
            base.bra = base.cursor;
            if (!(base.eq_s_b("\u03BA\u03BF\u03C1")))
            {
                return false;
            }
            if (!base.slice_from("\u03B9\u03C4\u03C3"))
            {
                return false;
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_steps9() {
        base.ket = base.cursor;
        if (base.find_among_b(a_21) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (base.find_among_b(a_19) == 0)
                {
                    break lab1;
                }
                if (base.cursor > base.limit_backward)
                {
                    break lab1;
                }
                if (!base.slice_from("\u03B9\u03B4"))
                {
                    return false;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            base.ket = base.cursor;
            base.bra = base.cursor;
            if (base.find_among_b(a_20) == 0)
            {
                return false;
            }
            if (!base.slice_from("\u03B9\u03B4"))
            {
                return false;
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_steps10() {
        base.ket = base.cursor;
        if (base.find_among_b(a_23) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_22) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B9\u03C3\u03BA"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step2a() {
        base.ket = base.cursor;
        if (base.find_among_b(a_24) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        {
            var /** number */ v_1 = base.limit - base.cursor;
            lab0: {
                if (base.find_among_b(a_25) == 0)
                {
                    break lab0;
                }
                return false;
            }
            base.cursor = base.limit - v_1;
        }
        {
            var /** number */ c1 = base.cursor;
            base.insert(base.cursor, base.cursor, "\u03B1\u03B4");
            base.cursor = c1;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step2b() {
        base.ket = base.cursor;
        if (base.find_among_b(a_26) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_27) == 0)
        {
            return false;
        }
        if (!base.slice_from("\u03B5\u03B4"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step2c() {
        base.ket = base.cursor;
        if (base.find_among_b(a_28) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_29) == 0)
        {
            return false;
        }
        if (!base.slice_from("\u03BF\u03C5\u03B4"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step2d() {
        base.ket = base.cursor;
        if (base.find_among_b(a_30) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_31) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B5"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step3() {
        base.ket = base.cursor;
        if (base.find_among_b(a_32) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (!(base.in_grouping_b(g_v, 945, 969)))
        {
            return false;
        }
        if (!base.slice_from("\u03B9"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step4() {
        base.ket = base.cursor;
        if (base.find_among_b(a_33) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (!(base.in_grouping_b(g_v, 945, 969)))
                {
                    break lab1;
                }
                if (!base.slice_from("\u03B9\u03BA"))
                {
                    return false;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            base.ket = base.cursor;
        }
        base.bra = base.cursor;
        if (base.find_among_b(a_34) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B9\u03BA"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5a() {
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            if (!(base.eq_s_b("\u03B1\u03B3\u03B1\u03BC\u03B5")))
            {
                break lab0;
            }
            if (base.cursor > base.limit_backward)
            {
                break lab0;
            }
            if (!base.slice_from("\u03B1\u03B3\u03B1\u03BC"))
            {
                return false;
            }
        }
        base.cursor = base.limit - v_1;
        var /** number */ v_2 = base.limit - base.cursor;
        lab1: {
            base.ket = base.cursor;
            if (base.find_among_b(a_35) == 0)
            {
                break lab1;
            }
            base.bra = base.cursor;
            if (!base.slice_del())
            {
                return false;
            }
            B_test1 = false;
        }
        base.cursor = base.limit - v_2;
        base.ket = base.cursor;
        if (!(base.eq_s_b("\u03B1\u03BC\u03B5")))
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_36) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B1\u03BC"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5b() {
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            base.ket = base.cursor;
            if (base.find_among_b(a_38) == 0)
            {
                break lab0;
            }
            base.bra = base.cursor;
            if (!base.slice_del())
            {
                return false;
            }
            B_test1 = false;
            base.ket = base.cursor;
            base.bra = base.cursor;
            if (base.find_among_b(a_37) == 0)
            {
                break lab0;
            }
            if (base.cursor > base.limit_backward)
            {
                break lab0;
            }
            if (!base.slice_from("\u03B1\u03B3\u03B1\u03BD"))
            {
                return false;
            }
        }
        base.cursor = base.limit - v_1;
        base.ket = base.cursor;
        if (!(base.eq_s_b("\u03B1\u03BD\u03B5")))
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab1: {
            var /** number */ v_2 = base.limit - base.cursor;
            lab2: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (!(base.in_grouping_b(g_v2, 945, 969)))
                {
                    break lab2;
                }
                if (!base.slice_from("\u03B1\u03BD"))
                {
                    return false;
                }
                break lab1;
            }
            base.cursor = base.limit - v_2;
            base.ket = base.cursor;
        }
        base.bra = base.cursor;
        if (base.find_among_b(a_39) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B1\u03BD"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5c() {
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            base.ket = base.cursor;
            if (base.find_among_b(a_40) == 0)
            {
                break lab0;
            }
            base.bra = base.cursor;
            if (!base.slice_del())
            {
                return false;
            }
            B_test1 = false;
        }
        base.cursor = base.limit - v_1;
        base.ket = base.cursor;
        if (!(base.eq_s_b("\u03B5\u03C4\u03B5")))
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab1: {
            var /** number */ v_2 = base.limit - base.cursor;
            lab2: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (!(base.in_grouping_b(g_v2, 945, 969)))
                {
                    break lab2;
                }
                if (!base.slice_from("\u03B5\u03C4"))
                {
                    return false;
                }
                break lab1;
            }
            base.cursor = base.limit - v_2;
            lab3: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (base.find_among_b(a_41) == 0)
                {
                    break lab3;
                }
                if (!base.slice_from("\u03B5\u03C4"))
                {
                    return false;
                }
                break lab1;
            }
            base.cursor = base.limit - v_2;
            base.ket = base.cursor;
        }
        base.bra = base.cursor;
        if (base.find_among_b(a_42) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B5\u03C4"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5d() {
        base.ket = base.cursor;
        if (base.find_among_b(a_43) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (!(base.eq_s_b("\u03B1\u03C1\u03C7")))
                {
                    break lab1;
                }
                if (base.cursor > base.limit_backward)
                {
                    break lab1;
                }
                if (!base.slice_from("\u03BF\u03BD\u03C4"))
                {
                    return false;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            base.ket = base.cursor;
            base.bra = base.cursor;
            if (!(base.eq_s_b("\u03BA\u03C1\u03B5")))
            {
                return false;
            }
            if (!base.slice_from("\u03C9\u03BD\u03C4"))
            {
                return false;
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5e() {
        base.ket = base.cursor;
        if (base.find_among_b(a_44) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (!(base.eq_s_b("\u03BF\u03BD")))
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03BF\u03BC\u03B1\u03C3\u03C4"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5f() {
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            base.ket = base.cursor;
            if (!(base.eq_s_b("\u03B9\u03B5\u03C3\u03C4\u03B5")))
            {
                break lab0;
            }
            base.bra = base.cursor;
            if (!base.slice_del())
            {
                return false;
            }
            B_test1 = false;
            base.ket = base.cursor;
            base.bra = base.cursor;
            if (base.find_among_b(a_45) == 0)
            {
                break lab0;
            }
            if (base.cursor > base.limit_backward)
            {
                break lab0;
            }
            if (!base.slice_from("\u03B9\u03B5\u03C3\u03C4"))
            {
                return false;
            }
        }
        base.cursor = base.limit - v_1;
        base.ket = base.cursor;
        if (!(base.eq_s_b("\u03B5\u03C3\u03C4\u03B5")))
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_46) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B9\u03B5\u03C3\u03C4"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5g() {
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            base.ket = base.cursor;
            if (base.find_among_b(a_47) == 0)
            {
                break lab0;
            }
            base.bra = base.cursor;
            if (!base.slice_del())
            {
                return false;
            }
            B_test1 = false;
        }
        base.cursor = base.limit - v_1;
        base.ket = base.cursor;
        if (base.find_among_b(a_50) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab1: {
            var /** number */ v_2 = base.limit - base.cursor;
            lab2: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (base.find_among_b(a_48) == 0)
                {
                    break lab2;
                }
                if (!base.slice_from("\u03B7\u03BA"))
                {
                    return false;
                }
                break lab1;
            }
            base.cursor = base.limit - v_2;
            base.ket = base.cursor;
            base.bra = base.cursor;
            if (base.find_among_b(a_49) == 0)
            {
                return false;
            }
            if (base.cursor > base.limit_backward)
            {
                return false;
            }
            if (!base.slice_from("\u03B7\u03BA"))
            {
                return false;
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5h() {
        base.ket = base.cursor;
        if (base.find_among_b(a_53) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (base.find_among_b(a_51) == 0)
                {
                    break lab1;
                }
                if (!base.slice_from("\u03BF\u03C5\u03C3"))
                {
                    return false;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            base.ket = base.cursor;
            base.bra = base.cursor;
            if (base.find_among_b(a_52) == 0)
            {
                return false;
            }
            if (base.cursor > base.limit_backward)
            {
                return false;
            }
            if (!base.slice_from("\u03BF\u03C5\u03C3"))
            {
                return false;
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5i() {
        var /** number */ among_var;
        base.ket = base.cursor;
        if (base.find_among_b(a_56) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (!(base.eq_s_b("\u03BA\u03BF\u03BB\u03BB")))
                {
                    break lab1;
                }
                if (!base.slice_from("\u03B1\u03B3"))
                {
                    return false;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab2: {
                var /** number */ v_2 = base.limit - base.cursor;
                lab3: {
                    base.ket = base.cursor;
                    base.bra = base.cursor;
                    among_var = base.find_among_b(a_54);
                    if (among_var == 0)
                    {
                        break lab3;
                    }
                    switch (among_var) {
                        case 1:
                            if (!base.slice_from("\u03B1\u03B3"))
                            {
                                return false;
                            }
                            break;
                    }
                    break lab2;
                }
                base.cursor = base.limit - v_2;
                base.ket = base.cursor;
                base.bra = base.cursor;
                if (base.find_among_b(a_55) == 0)
                {
                    return false;
                }
                if (base.cursor > base.limit_backward)
                {
                    return false;
                }
                if (!base.slice_from("\u03B1\u03B3"))
                {
                    return false;
                }
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5j() {
        base.ket = base.cursor;
        if (base.find_among_b(a_57) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_58) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B7\u03C3"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5k() {
        base.ket = base.cursor;
        if (base.find_among_b(a_59) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_60) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03B7\u03C3\u03C4"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5l() {
        base.ket = base.cursor;
        if (base.find_among_b(a_61) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_62) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03BF\u03C5\u03BD"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step5m() {
        base.ket = base.cursor;
        if (base.find_among_b(a_63) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        B_test1 = false;
        base.ket = base.cursor;
        base.bra = base.cursor;
        if (base.find_among_b(a_64) == 0)
        {
            return false;
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        if (!base.slice_from("\u03BF\u03C5\u03BC"))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step6() {
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            base.ket = base.cursor;
            if (base.find_among_b(a_65) == 0)
            {
                break lab0;
            }
            base.bra = base.cursor;
            if (!base.slice_from("\u03BC\u03B1"))
            {
                return false;
            }
        }
        base.cursor = base.limit - v_1;
        if (!B_test1)
        {
            return false;
        }
        base.ket = base.cursor;
        if (base.find_among_b(a_66) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step7() {
        base.ket = base.cursor;
        if (base.find_among_b(a_67) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    this.stem = /** @return {boolean} */ function() {
        base.limit_backward = base.cursor; base.cursor = base.limit;
        var /** number */ v_1 = base.limit - base.cursor;
        r_tolower();
        base.cursor = base.limit - v_1;
        if (!r_has_min_length())
        {
            return false;
        }
        B_test1 = true;
        var /** number */ v_2 = base.limit - base.cursor;
        r_step1();
        base.cursor = base.limit - v_2;
        var /** number */ v_3 = base.limit - base.cursor;
        r_steps1();
        base.cursor = base.limit - v_3;
        var /** number */ v_4 = base.limit - base.cursor;
        r_steps2();
        base.cursor = base.limit - v_4;
        var /** number */ v_5 = base.limit - base.cursor;
        r_steps3();
        base.cursor = base.limit - v_5;
        var /** number */ v_6 = base.limit - base.cursor;
        r_steps4();
        base.cursor = base.limit - v_6;
        var /** number */ v_7 = base.limit - base.cursor;
        r_steps5();
        base.cursor = base.limit - v_7;
        var /** number */ v_8 = base.limit - base.cursor;
        r_steps6();
        base.cursor = base.limit - v_8;
        var /** number */ v_9 = base.limit - base.cursor;
        r_steps7();
        base.cursor = base.limit - v_9;
        var /** number */ v_10 = base.limit - base.cursor;
        r_steps8();
        base.cursor = base.limit - v_10;
        var /** number */ v_11 = base.limit - base.cursor;
        r_steps9();
        base.cursor = base.limit - v_11;
        var /** number */ v_12 = base.limit - base.cursor;
        r_steps10();
        base.cursor = base.limit - v_12;
        var /** number */ v_13 = base.limit - base.cursor;
        r_step2a();
        base.cursor = base.limit - v_13;
        var /** number */ v_14 = base.limit - base.cursor;
        r_step2b();
        base.cursor = base.limit - v_14;
        var /** number */ v_15 = base.limit - base.cursor;
        r_step2c();
        base.cursor = base.limit - v_15;
        var /** number */ v_16 = base.limit - base.cursor;
        r_step2d();
        base.cursor = base.limit - v_16;
        var /** number */ v_17 = base.limit - base.cursor;
        r_step3();
        base.cursor = base.limit - v_17;
        var /** number */ v_18 = base.limit - base.cursor;
        r_step4();
        base.cursor = base.limit - v_18;
        var /** number */ v_19 = base.limit - base.cursor;
        r_step5a();
        base.cursor = base.limit - v_19;
        var /** number */ v_20 = base.limit - base.cursor;
        r_step5b();
        base.cursor = base.limit - v_20;
        var /** number */ v_21 = base.limit - base.cursor;
        r_step5c();
        base.cursor = base.limit - v_21;
        var /** number */ v_22 = base.limit - base.cursor;
        r_step5d();
        base.cursor = base.limit - v_22;
        var /** number */ v_23 = base.limit - base.cursor;
        r_step5e();
        base.cursor = base.limit - v_23;
        var /** number */ v_24 = base.limit - base.cursor;
        r_step5f();
        base.cursor = base.limit - v_24;
        var /** number */ v_25 = base.limit - base.cursor;
        r_step5g();
        base.cursor = base.limit - v_25;
        var /** number */ v_26 = base.limit - base.cursor;
        r_step5h();
        base.cursor = base.limit - v_26;
        var /** number */ v_27 = base.limit - base.cursor;
        r_step5j();
        base.cursor = base.limit - v_27;
        var /** number */ v_28 = base.limit - base.cursor;
        r_step5i();
        base.cursor = base.limit - v_28;
        var /** number */ v_29 = base.limit - base.cursor;
        r_step5k();
        base.cursor = base.limit - v_29;
        var /** number */ v_30 = base.limit - base.cursor;
        r_step5l();
        base.cursor = base.limit - v_30;
        var /** number */ v_31 = base.limit - base.cursor;
        r_step5m();
        base.cursor = base.limit - v_31;
        var /** number */ v_32 = base.limit - base.cursor;
        r_step6();
        base.cursor = base.limit - v_32;
        var /** number */ v_33 = base.limit - base.cursor;
        r_step7();
        base.cursor = base.limit - v_33;
        base.cursor = base.limit_backward;
        return true;
    };

    /**@return{string}*/
    this['stemWord'] = function(/**string*/word) {
        base.setCurrent(word);
        this.stem();
        return base.getCurrent();
    };
};

const stemmers = { english: new JsEnglishStemmer(), french: new JsFrenchStemmer(), arabic: new JsArabicStemmer(), greek: new JsGreekStemmer() };

/** The Snowball stem of a lowercased word. */
export function stem(language, word) {
  return stemmers[language].stemWord(word);
}
