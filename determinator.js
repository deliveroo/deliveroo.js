const md5 = require('md5');

class Determinator {

  constructor(retrieval, logger) {
    this.retrieval = retrieval;
    this.log = logger || (() => {});
  }

  determinate(featureId, id, guid, properties = {}) {
    const feature = this.retrieval.retrieve(featureId);
    this.log('start', `Determinating '${feature.name}'`, 'The given ID, GUID and properties will be used to determine which target groups this actor is in, and will deterministically return an outcome for the visibility of this feature for them.')

    const actorIdentifier = this._actorIdentifier(feature, id, guid);
    if (actorIdentifier === undefined) return false;

    if (feature === undefined) return false;
    if (!feature.active) {
      this.log('fail', 'Feature is inactive', 'Every actor is excluded');
      return false;
    }

    const rollout = this._chooseRollout(feature, properties);
    if (rollout == 0) {
      this.log('fail', '0% for matching target groups', 'No matching target groups have a rollout larger than 0%. This actor is excluded.');
      return false;
    }

    const percentage = Math.round(rollout / 6.5536) / 100;
    this.log('info', `${percentage}% chance of being included`, `The largest matching rollout percentage is ${percentage}%, giving this actor a ${percentage}% chance of being included.`);

    const {rolloutIndicator, variantIndicator} = this._indicators(feature, actorIdentifier);
    if (rolloutIndicator >= rollout) {
      this.log('fail', `Determinated to be outside the ${percentage}%`, 'This actor is excluded');
      return false;
    } else {
      this.log('continue', `Determinated to be inside the ${percentage}%`, 'This actor is included');
    }

    if (!feature.variants || Object.keys(feature.variants).length === 0) {
      this.log('success', 'Feature flag on for this actor', 'Determinator will return true for this actor and this feature in any system that is correctly set up.');
      return true;
    }

    const variant = this._chooseVariant(feature, variantIndicator);
    this.log('success', `In the '${variant}' variant`, `Determinator will return '${variant}' for this actor and this feature in any system that is correctly set up.`);
    return variant;
  }

  _chooseRollout(feature, properties) {
    return feature.target_groups.reduce((result, tg) => {
      this.log('target_group', `Checking '${tg.name}' target group`, 'An actor must match at least one non-zero target group in order to be included.');
      if (tg.rollout > 65536 || tg.rollout <= 0) {
        this.log('pass', 'Target group has 0% rollout', 'No actor can be included.');
        return result;
      }

      const match = Object.keys(tg.constraints).every((constraint) => {
        const constraintValues = this._arrayOfStringify(tg.constraints[constraint]);
        const propertyValues = this._arrayOfStringify(properties[constraint]);

        if (!properties.hasOwnProperty(constraint)) {
          this.log('pass', `Missing required '${constraint}' property`, `This target group requires the '${constraint}' property to be one of the following values to match: ${constraintValues.join(', ')}`);
          return false;
        }

        const includes = constraintValues.some((value) => propertyValues.includes(value));

        if (!includes) {
          this.log('pass', `'${constraint}' property is unacceptable`, `Does not include any of the required values: ${constraintValues.join(', ')}`);
        }

        return includes
      });

      if (match) {
        const percentage = Math.round(tg.rollout / 6.5536) / 100;
        this.log('continue', `Matches the '${tg.name}' target group`, `Matching this target group allows this actor a ${percentage}% chance of being included.`);
      }

      return (match && tg.rollout > result) ? tg.rollout : result;
    }, 0);
  }

  _actorIdentifier(feature, id, guid) {
    switch(feature.bucket_type) {
    case 'id':
      if (!this._emptyString(id)) return id;
      this.log('fail', 'No ID given, cannot determinate', 'For ID bucketed features an ID must be given to have the possibility of being included.');
      return undefined;

    case 'guid':
      if (!this._emptyString(guid)) return guid;
      throw 'A GUID must always be given for GUID bucketed features';

    case 'fallback':
      const identifier = id || guid;
      if (!this._emptyString(identifier)) return identifier;
      throw 'An ID or GUID must always be given for Fallback bucketed features';

    case 'single':
      this.log('random', 'Randomised rollout', 'Unbucketed features will be on or off at random at the rollout percentage of time.');
      return Math.random().toString();

    default:
      this.log('fail', 'Unknown bucket type', `The bucket type '${feature.bucket_type}' is not understood by Determinator. All actors will be excluded.`);
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

    const weightTotal = Object.values(feature.variants).reduce((sum, n) => sum + n, 0);
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
