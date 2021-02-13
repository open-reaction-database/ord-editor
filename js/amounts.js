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
  init,
  load,
  unload,
};

const utils = goog.require('ord.utils');

const Amount = goog.require('proto.ord.Amount');
const Mass = goog.require('proto.ord.Mass');
const MassUnit = goog.require('proto.ord.Mass.MassUnit');
const Moles = goog.require('proto.ord.Moles');
const MolesUnit = goog.require('proto.ord.Moles.MolesUnit');
const Volume = goog.require('proto.ord.Volume');
const VolumeUnit = goog.require('proto.ord.Volume.VolumeUnit');

// Freely create radio button groups by generating new input names.
let radioGroupCounter = 0;

/**
 * Initializes the radio buttons and selectors for an Amount section.
 * @param {!jQuery} node The parent div containing the Amount section.
 */
function init(node) {
  const amountButtons = $('.amount input', node);
  amountButtons.attr('name', 'amount_' + radioGroupCounter++);
  amountButtons.on('change', function() {
    $('.amount .selector', node).hide();
    if (this.value === 'mass') {
      $('.amount_units_mass', node).show();
      $('.includes_solutes', node).hide();
    }
    if (this.value === 'moles') {
      $('.amount_units_moles', node).show();
      $('.includes_solutes', node).hide();
    }
    if (this.value === 'volume') {
      $('.amount_units_volume', node).show();
      $('.includes_solutes', node).show().css('display', 'inline-block');
    }
  });
}

/**
 * Adds and populates the form's fields describing the amount of a compound.
 * @param {!jQuery} node The div corresponding to the compound whose amount fields
 *     on the form should be updated.
 * @param {?Amount} amount
 */
function load(node, amount) {
  if (!amount) {
    return;
  }
  const amountNode = $('.amount', node).first();
  $('.amount_units_mass', node).hide();
  $('.amount_units_moles', node).hide();
  $('.amount_units_volume', node).hide();
  $('.includes_solutes', node).hide();
  if (amount.hasMass()) {
    $('input[value=\'mass\']', amountNode).trigger('click');
    if (amount.getMass().hasValue()) {
      $('.amount_value', node).text(amount.getMass().getValue());
    }
    if (amount.getMass().hasPrecision()) {
      $('.amount_precision', node).text(amount.getMass().getPrecision());
    }
    $('.amount_units_mass', node).show();
    utils.setSelector(
        $('.amount_units_mass', amountNode), amount.getMass().getUnits());
  } else if (amount.hasMoles()) {
    $('input[value=\'moles\']', amountNode).trigger('click');
    if (amount.getMoles().hasValue()) {
      $('.amount_value', node).text(amount.getMoles().getValue());
    }
    if (amount.getMoles().hasPrecision()) {
      $('.amount_precision', node).text(amount.getMoles().getPrecision());
    }
    $('.amount_units_moles', node).show();
    utils.setSelector(
        $('.amount_units_moles', amountNode), amount.getMoles().getUnits());
  } else if (amount.hasVolume()) {
    $('input[value=\'volume\']', amountNode).trigger('click');
    if (amount.getVolume().hasValue()) {
      $('.amount_value', node).text(amount.getVolume().getValue());
    }
    if (amount.getVolume().hasPrecision()) {
      $('.amount_precision', node).text(amount.getVolume().getPrecision());
    }
    $('.amount_units_volume', node).show();
    $('.includes_solutes', node).show().css('display', 'inline-block');
    const solutes = amount.hasVolumeIncludesSolutes() ?
        amount.getVolumeIncludesSolutes() :
        null;
    utils.setOptionalBool($('.includes_solutes.optional_bool', node), solutes);
    utils.setSelector(
        $('.amount_units_volume', amountNode), amount.getVolume().getUnits());
  }
}

/**
 * Creates an Amount message according to the form.
 * @param {!jQuery} node The parent node for the amount fields.
 * @return {!Amount}
 */
function unload(node) {
  const amount = new Amount();
  // NOTE(kearnes): Take the closest amount section; there may be others
  // nested deeper (e.g. in ProductMeasurement fields under a ReactionProduct).
  node = $('.amount', node).first();
  const mass = unloadMass(node);
  const moles = unloadMoles(node);
  const volume = unloadVolume(node);
  if (!utils.isEmptyMessage(mass)) {
    amount.setMass(mass);
  } else if (!utils.isEmptyMessage(moles)) {
    amount.setMoles(moles);
  } else if (!utils.isEmptyMessage(volume)) {
    amount.setVolume(volume);
    const solutes =
        utils.getOptionalBool($('.includes_solutes.optional_bool', node));
    if (solutes !== null) {
      amount.setVolumeIncludesSolutes(solutes);
    }
  }
  return amount;
}

/**
 * Reads and returns a mass amount of a compound as defined in the form.
 * @param {!jQuery} node The div corresponding to the compound whose mass fields
 *     should be read from the form.
 * @return {!Mass}
 */
function unloadMass(node) {
  const mass = new Mass();
  if (!$('.amount_mass', node).is(':checked')) {
    return mass;
  }
  const value = parseFloat($('.amount_value', node).text());
  if (!isNaN(value)) {
    mass.setValue(value);
  }
  const units = utils.getSelectorText($('.amount_units_mass', node)[0]);
  mass.setUnits(MassUnit[units]);
  const precision = parseFloat($('.amount_precision', node).text());
  if (!isNaN(precision)) {
    mass.setPrecision(precision);
  }
  return mass;
}

/**
 * Reads and returns a molar amount of a compound as defined in the form.
 * @param {!jQuery} node The div corresponding to the compound whose moles fields
 *     should be read from the form.
 * @return {!Moles}
 */
function unloadMoles(node) {
  const moles = new Moles();
  if (!$('.amount_moles', node).is(':checked')) {
    return moles;
  }
  const value = parseFloat($('.amount_value', node).text());
  if (!isNaN(value)) {
    moles.setValue(value);
  }
  const units = utils.getSelectorText($('.amount_units_moles', node)[0]);
  moles.setUnits(MolesUnit[units]);
  const precision = parseFloat($('.amount_precision', node).text());
  if (!isNaN(precision)) {
    moles.setPrecision(precision);
  }
  return moles;
}

/**
 * Reads and returns a volumetric amount of a compound as defined in the form.
 * @param {!jQuery} node The div corresponding to the compound whose volume fields
 *     should be read from the form.
 * @return {!Volume}
 */
function unloadVolume(node) {
  const volume = new Volume();
  if (!$('.amount_volume', node).is(':checked')) {
    return volume;
  }
  const value = parseFloat($('.amount_value', node).text());
  if (!isNaN(value)) {
    volume.setValue(value);
  }
  const units = utils.getSelectorText($('.amount_units_volume', node)[0]);
  volume.setUnits(VolumeUnit[units]);
  const precision = parseFloat($('.amount_precision', node).text());
  if (!isNaN(precision)) {
    volume.setPrecision(precision);
  }
  return volume;
}
