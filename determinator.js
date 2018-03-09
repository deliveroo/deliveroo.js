const md5 = require('md5');

class Determinator {

  constructor(retrieval, logger) {
    this.retrieval = retrieval;
    this.log = logger ? logger.log : () => {};
  }

  determinate(featureId, id, guid, properties = {}) {
    const feature = this.retrieval.retrieve(featureId);
    this.log(`🤖 Determinating feature '${feature.name}' for actor (id: ${id}, guid: ${guid}, properties: ${JSON.stringify(properties)}).`)

    if (feature === undefined) return false;
    if (!feature.active) {
      this.log('⛔️ Feature is inactive, every actor is excluded.');
      return false;
    }

    const rollout = this._chooseRollout(feature, properties);
    if (rollout == 0) {
      this.log('⛔️ No target groups with positive rollouts match. This actor is excluded.');
      return false;
    }

    const percentage = Math.round(rollout / 6.5536) / 100;
    this.log(`ℹ️ Using the largest rollout of ${percentage}%.`)

    const actorIdentifier = this._actorIdentifier(feature, id, guid);
    if (actorIdentifier === undefined) {
      this.log('⛔️ No suitable identifier available. This actor is excluded.');
      return false;
    }

    const {rolloutIndicator, variantIndicator} = this._indicators(feature, actorIdentifier);
    if (rolloutIndicator >= rollout) {
      this.log(`⛔️ This actor is randomly allocated outside the ${percentage}% and is excluded.`);
      return false;
    } else {
      this.log(`👍 This actor is randomly allocated inside the ${percentage}%.`);
    }

    if (!feature.variants || Object.keys(feature.variants).length === 0) {
      this.log('✅ The feature flag is on for this actor.');
      return true;
    }

    const variant = this._chooseVariant(feature, variantIndicator);
    this.log(`✅ The actor has been allocated to the '${variant}' variant.`);
    return variant;
  }

  _chooseRollout(feature, properties) {
    return feature.target_groups.reduce((result, tg) => {
      this.log(`🎯 Checking whether the actor is in the '${tg.name}' target group.`)
      if (tg.rollout > 65536 || tg.rollout <= 0) return result;

      const match = Object.keys(tg.constraints).every((constraint) => {
        if (!properties.hasOwnProperty(constraint)) {
          this.log(`  👎 This actor does not have a required '${constraint}' property.`)
          return false;
        }

        const constraintValues = this._arrayOfStringify(tg.constraints[constraint]);
        const propertyValues = this._arrayOfStringify(properties[constraint]);
        const includes = constraintValues.some((value) => propertyValues.includes(value));

        if (includes) {
          this.log(`  ℹ️ This actor's '${constraint}' property includes one of the required values (${constraintValues.join(', ')}).`)
        } else {
          this.log(`  👎 This actor's '${constraint}' property does not include any of the required values: (${constraintValues.join(', ')}).`)
        }

        return includes
      });

      if (match) {
        const percentage = Math.round(tg.rollout / 6.5536) / 100;
        this.log(`  👍 This actor is in the '${tg.name}' target group (rollout: ${percentage}%).`)
      } else {
        this.log(`  👎 This actor is not in the '${tg.name}' target group.`)
      }

      return (match && tg.rollout > result) ? tg.rollout : result;
    }, 0);
  }

  _actorIdentifier(feature, id, guid) {
    switch(feature.bucket_type) {
    case 'id':
      if (!this._emptyString(id)) return id;
      this.log('ℹ️ No ID given. This actor will be excluded.');
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
