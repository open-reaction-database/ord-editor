/**
 * Copyright 2020 Open Reaction Database Project Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

goog.module('ord.amounts');
goog.module.declareLegacyNamespace();
exports = {
  load,
  unload,
  unloadVolume
};

goog.require('proto.ord.Amount');
goog.require('proto.ord.Mass');
goog.require('proto.ord.Moles');
goog.require('proto.ord.Volume');

/**
 * Adds and populates the form's fields describing the amount of a compound.
 * @param {!Node} node The div corresponding to the compound whose amount fields
 *     on the form should be updated.
 * @param {?proto.ord.Amount} amount
 */
function load(node, amount) {
  const amountNode = $('.amount', node);
  $('.amount_units_mass', node).hide();
  $('.amount_units_moles', node).hide();
  $('.amount_units_volume', node).hide();
  $('.includes_solutes', node).hide();
  if (amount.mass) {
    $('input[value=\'mass\']', amountNode).prop('checked', true);
    if (amount.mass.hasValue()) {
      $('.amount_value', node).text(amount.mass.getValue());
    }
    if (amount.mass.hasPrecision()) {
      $('.amount_precision', node).text(amount.mass.getPrecision());
    }
    $('.amount_units_mass', node).show();
    ord.reaction.setSelector(
        $('.amount_units_mass', amountNode), amount.mass.getUnits());
  } else if (amount.moles) {
    $('input[value=\'moles\']', amountNode).prop('checked', true);
    if (amount.moles.hasValue()) {
      $('.amount_value', node).text(amount.moles.getValue());
    }
    if (amount.moles.hasPrecision()) {
      $('.amount_precision', node).text(amount.moles.getPrecision());
    }
    $('.amount_units_moles', node).show();
    ord.reaction.setSelector(
        $('.amount_units_moles', amountNode), amount.moles.getUnits());
  } else if (amount.volume) {
    $('input[value=\'volume\']', amountNode).prop('checked', true);
    if (amount.volume.hasValue()) {
      $('.amount_value', node).text(amount.volume.getValue());
    }
    if (amount.volume.hasPrecision()) {
      $('.amount_precision', node).text(amount.volume.getPrecision());
    }
    $('.amount_units_volume', node).show();
    $('.includes_solutes', node).show().css('display', 'inline-block');
    const solutes = amount.hasVolumeIncludesSolutes() ?
        amount.getVolumeIncludesSolutes() :
        null;
    ord.reaction.setOptionalBool(
        $('.includes_solutes .optional_bool', node), solutes);
    ord.reaction.setSelector(
        $('.amount_units_volume', amountNode), amount.volume.getUnits());
  }
}

/**
 * Creates an Amount message according to the form.
 * @param {!Node} node The parent node for the amount fields.
 * @return {!proto.ord.Amount}
 */
function unload(node) {
  const amount = new proto.ord.Amount();
  const mass = unloadMass(node);
  const moles = unloadMoles(node);
  const volume = unloadVolume(node);
  if (mass) {
    if (!ord.reaction.isEmptyMessage(mass)) {
      amount.setMass(mass);
    }
  } else if (moles) {
    if (!ord.reaction.isEmptyMessage(moles)) {
      amount.setMoles(moles);
    }
  } else if (volume) {
    if (!ord.reaction.isEmptyMessage(volume)) {
      amount.setVolume(volume);
      const solutes = ord.reaction.getOptionalBool(
          $('.includes_solutes .optional_bool', node));
      amount.setVolumeIncludesSolutes(solutes);
    }
  }
}

/**
 * Reads and returns a mass amount of a compound as defined in the form.
 * @param {!Node} node The div corresponding to the compound whose mass fields
 *     should be read from the form.
 * @return {?proto.ord.Mass}
 */
function unloadMass(node) {
  if (!$('.amount_mass', node).is(':checked')) {
    return null;
  }
  const mass = new proto.ord.Mass();
  const value = parseFloat($('.amount_value', node).text());
  if (!isNaN(value)) {
    mass.setValue(value);
  }
  const units = ord.reaction.getSelector($('.amount_units_mass', node));
  mass.setUnits(units);
  const precision = parseFloat($('.amount_precision', node).text());
  if (!isNaN(precision)) {
    mass.setPrecision(precision);
  }
  return mass;
}

/**
 * Reads and returns a molar amount of a compound as defined in the form.
 * @param {!Node} node The div corresponding to the compound whose moles fields
 *     should be read from the form.
 * @return {?proto.ord.Moles}
 */
function unloadMoles(node) {
  if (!$('.amount_moles', node).is(':checked')) {
    return null;
  }
  const moles = new proto.ord.Moles();
  const value = parseFloat($('.amount_value', node).text());
  if (!isNaN(value)) {
    moles.setValue(value);
  }
  const units = ord.reaction.getSelector($('.amount_units_moles', node));
  moles.setUnits(units);
  const precision = parseFloat($('.amount_precision', node).text());
  if (!isNaN(precision)) {
    moles.setPrecision(precision);
  }
  return moles;
}

/**
 * Reads and returns a volumetric amount of a compound as defined in the form.
 * @param {!Node} node The div corresponding to the compound whose volume fields
 *     should be read from the form.
 * @return {?proto.ord.Volume}
 */
function unloadVolume(node) {
  if (!$('.amount_volume', node).is(':checked')) {
    return null;
  }
  const volume = new proto.ord.Volume();
  const value = parseFloat($('.amount_value', node).text());
  if (!isNaN(value)) {
    volume.setValue(value);
  }
  const units = ord.reaction.getSelector($('.amount_units_volume', node));
  volume.setUnits(units);
  const precision = parseFloat($('.amount_precision', node).text());
  if (!isNaN(precision)) {
    volume.setPrecision(precision);
  }
  return volume;
}
