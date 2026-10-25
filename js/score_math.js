// Helper utility for exact unbounded score operations
(function() {
  const ScoreMath = {
    // Parse any existing string, Number, or BigInt safely into an exact BigInt
    toBigInt(val) {
      if (typeof val === 'bigint') return val;
      if (val === null || val === undefined) return 0n;
      if (typeof val === 'number') {
        if (!Number.isFinite(val) || val <= 0) return 0n;
        return BigInt(Math.floor(val));
      }
      const str = String(val).trim();
      if (!str || str === 'NaN' || str === 'null') return 0n;
      try {
        // Strip any fractional part or scientific notation
        if (str.includes('.') || str.toLowerCase().includes('e')) {
          const num = parseFloat(str);
          if (Number.isFinite(num) && num > 0) {
            return BigInt(Math.floor(num));
          }
          return 0n;
        }
        // Match only integer digits
        const clean = str.replace(/[^\d]/g, '');
        return clean.length > 0 ? BigInt(clean) : 0n;
      } catch (e) {
        return 0n;
      }
    },

    // Format for HUD and UI display
    // Preserves 5-digit pad for scores < 100,000 (classic retro feel)
    // Scales to full integer string or compact suffix notation for massive numbers
    formatScore(val) {
      const b = this.toBigInt(val);
      if (b < 100000n) {
        return b.toString().padStart(5, '0');
      }
      if (b < 1000000n) {
        return b.toString();
      }

      // Compact representation for enormous numbers exceeding HUD width:
      // Millions (M), Billions (B), Trillions (T), Quadrillions (Q), etc.
      const str = b.toString();
      const len = str.length;

      const suffixes = [
        { exp: 3, sym: 'K' },
        { exp: 6, sym: 'M' },
        { exp: 9, sym: 'B' },
        { exp: 12, sym: 'T' },
        { exp: 15, sym: 'Qa' },
        { exp: 18, sym: 'Qi' },
        { exp: 21, sym: 'Sx' },
        { exp: 24, sym: 'Sp' },
        { exp: 27, sym: 'Oc' },
        { exp: 30, sym: 'No' },
        { exp: 33, sym: 'Dc' }
      ];

      for (let i = suffixes.length - 1; i >= 0; i--) {
        const s = suffixes[i];
        if (len > s.exp && len <= s.exp + 3) {
          const intPartLen = len - s.exp;
          const intPart = str.slice(0, intPartLen);
          let decPart = str.slice(intPartLen, intPartLen + 2);
          if (decPart.endsWith('0')) decPart = decPart.slice(0, 1);
          if (decPart === '0' || decPart === '') {
            return `${intPart}${s.sym}`;
          }
          return `${intPart}.${decPart}${s.sym}`;
        }
      }

      // For astronomical numbers beyond standard suffixes (10^36+), use scientific notation
      const lead = str[0];
      let decimals = str.slice(1, 3);
      if (decimals.endsWith('0')) decimals = decimals.slice(0, 1);
      if (decimals === '0' || decimals === '') {
        return `${lead}e${len - 1}`;
      }
      return `${lead}.${decimals}e${len - 1}`;
    }
  };

  if (typeof window !== 'undefined') {
    window.ScoreMath = ScoreMath;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScoreMath;
  }
})();
