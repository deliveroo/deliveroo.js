const md5 = require('md5');

class Determinator {

  constructor(retrieval) {
    this.retrieval = retrieval;
  }

  determinate(featureId, id, guid, properties) {
    const feature = this.retrieval.retrieve(featureId);

    if (feature === undefined) return false;
    if (!feature.active) return false;

    const rollout = this._chooseRollout(feature, properties);
    if (rollout == 0) return false;

    const actorIdentifier = this._actorIdentifier(feature, id, guid);
    if (actorIdentifier === undefined) return false;

    const {rolloutIndicator, variantIndicator} = this._indicators(feature, actorIdentifier);
    if (rolloutIndicator >= rollout) return false;

    if (!feature.variants || feature.variants.length == 0) return true;

    return this._chooseVariant(feature, variantIndicator);
  }

  _chooseRollout(feature, properties) {
    return feature.target_groups.reduce((result, tg) => {
      if (tg.rollout > 65536 || tg.rollout <= 0) return result;

      const match = Object.keys(tg.constraints).every((constraint) => {
        if (!properties.hasOwnProperty(constraint)) return false;

        const constraintValues = this._arrayOfStringify(tg.constraints[constraint]);
        const propertyValues = this._arrayOfStringify(properties[constraint]);
        return constraintValues.some((value) => propertyValues.includes(value));
      });

      return (match && tg.rollout > result) ? tg.rollout : result;
    }, 0);
  }

  _actorIdentifier(feature, id, guid) {
    switch(feature.bucket_type) {
    case 'id':
      if (!this._emptyString(id)) return id;
      return undefined;

    case 'guid':
      if (!this._emptyString(guid)) return guid;
      throw 'A GUID must always be given for GUID bucketed features';

    case 'fallback':
      const identifier = id || guid;
      if (!this._emptyString(identifier)) return identifier;
      throw 'An ID or GUID must always be given for Fallback bucketed features';

    case 'single':
      return 'all';

    default:
      // TODO: Log non-blocking error
      return undefined;
    }
  }

  _indicators(feature, actorIdentifier) {
    const hash = md5(`${feature.identifier || feature.name},${actorIdentifier}`);

    const rolloutIndicator = parseInt(hash.substr(0, 4), 16);
    const variantIndicator = parseInt(hash.substr(4, 4), 16);

    return { rolloutIndicator, variantIndicator };
  }

  _chooseVariant(feature, variantIndicator) {
    if (feature.winning_variant) return feature.winning_variant;

    const weightTotal = Object.values(feature.variants).reduce((sum, n) => sum + n);
    const scaleFactor = 65535 / weightTotal;

    const sortedVariants = Object.keys(feature.variants).sort();

    let variant;
    let i, upperBound = 0;
    for (i in sortedVariants) {
      variant = sortedVariants[i];
      upperBound = upperBound + (feature.variants[variant] * scaleFactor);
      if (variantIndicator <= upperBound) return variant;
    }

    return variant;
  }

  _emptyString(obj) {
    if (typeof obj != 'string') return true;
    if (obj == '') return true;
    return false;
  }

  _arrayOfStringify(obj) {
    if (!Array.isArray(obj)) return [String(obj)];
    
    return obj.filter((o) => String(o))
  }
}

module.exports = Determinator;
