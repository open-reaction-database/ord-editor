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

goog.module('ord.products');
goog.module.declareLegacyNamespace();
exports = {
  load,
  unload,
  add,
  addMeasurement,
  validateProduct,
  validateMeasurement
};

goog.require('ord.amounts');
goog.require('ord.compounds');
goog.require('proto.ord.ProductMeasurement')
goog.require('proto.ord.ReactionProduct');

// Freely create radio button groups by generating new input names.
let radioGroupCounter = 0;

/**
 * Adds and populates the products section of the form.
 * @param {!Node} node The target node for the product divs.
 * @param {!Array<!proto.ord.ReactionProduct>} products
 */
function load(node, products) {
  products.forEach(product => loadProduct(node, product));
}

/**
 * Adds and populates a product section in the form.
 * @param {!Node} outcomeNode The parent ReactionOutcome node.
 * @param {!proto.ord.ReactionProduct} product
 */
function loadProduct(outcomeNode, product) {
  const node = add(outcomeNode);

  const identifiers = product.getIdentifiersList();
  identifiers.forEach(identifier => {
    ord.compounds.loadIdentifier(node, identifier);
  })

  ord.reaction.setOptionalBool(
      $('.outcome_product_desired', node),
      product.hasIsDesiredProduct() ? product.getIsDesiredProduct() : null);
  ord.amounts.load(node, product.getAmount());
  product.getMeasurementsList().forEach(
      measurement => loadMeasurement(node, measurement));
  $('.outcome_product_color', node).text(product.getIsolatedColor());
  const texture = product.getTexture();
  if (texture) {
    ord.reaction.setSelector(
        $('.outcome_product_texture_type', node), texture.getType());
    $('.outcome_product_texture_details', node).text(texture.getDetails());
  }
  const features = product.getFeaturesMap();
  const featureNames = features.stringKeys_();
  featureNames.forEach(function(name) {
    const feature = features.get(name);
    const featureNode = ord.compounds.addFeature(node);
    ord.compounds.loadFeature(featureNode, name, feature);
  });
}

/**
 * Fetches the products defined in the form.
 * @param {!Node} node The parent ReactionOutcome node.
 * @return {!Array<!proto.ord.ReactionProduct>}
 */
function unload(node) {
  const products = [];
  $('.outcome_product', node).each(function(index, productNode) {
    productNode = $(productNode);
    if (!productNode.attr('id')) {
      // Not a template.
      const product = unloadProduct(productNode);
      if (!ord.reaction.isEmptyMessage(product)) {
        products.push(product);
      }
    }
  });
  return products;
}

/**
 * Fetches a product defined in the form.
 * @param {!Node} node An element containing a product.
 * @return {!proto.ord.ReactionProduct}
 */
function unloadProduct(node) {
  const product = new proto.ord.ReactionProduct();

  const identifiers = ord.compounds.unloadIdentifiers(node);
  if (!ord.reaction.isEmptyMessage(identifiers)) {
    product.setIdentifiersList(identifiers);
  }

  product.setIsDesiredProduct(
      ord.reaction.getOptionalBool($('.outcome_product_desired', node)));
  const amount = ord.amounts.unload(node);
  if (!ord.reaction.isEmptyMessage(amount)) {
    product.setAmount(amount);
  }
  const measurements = [];
  $('.product_measurement', node).each(function(index, measurementNode) {
    measurementNode = $(measurementNode);
    if (!measurementNode.attr('id')) {
      // Not a template.
      const measurement = unloadMeasurement(measurementNode);
      if (!ord.reaction.isEmptyMessage(measurement)) {
        measurements.push(measurement);
      }
    }
  });
  product.setMeasurementsList(measurements);
  const color = $('.outcome_product_color', node).text();
  product.setIsolatedColor(color);
  const texture = new proto.ord.ReactionProduct.Texture();
  texture.setType(
      ord.reaction.getSelector($('.outcome_product_texture_type', node)));
  texture.setDetails($('.outcome_product_texture_details', node).text());
  if (!ord.reaction.isEmptyMessage(texture)) {
    product.setTexture(texture);
  }

  const featuresMap = product.getFeaturesMap();
  $('.feature', node).each(function(index, featureNode) {
    featureNode = $(featureNode);
    if (!featureNode.attr('id')) {
      ord.compounds.unloadFeature(featureNode, featuresMap);
    }
  });

  return product;
}

/**
 * Fetches the set of Analysis keys.
 * @param {!Node} node The parent ReactionOutcome div.
 * @param {string} tag Analysis target, e.g. "identities", "yields", etc.
 * @return {!Array<string>}
 */
function unloadAnalysisKeys(node, tag) {
  const values = [];
  $('.outcome_product_analysis_' + tag, node).each(function(index, tagNode) {
    tagNode = $(tagNode);
    if (!tagNode.attr('id')) {
      // Not a template.
      const value = $('.analysis_key_selector', tagNode).val();
      if (value != '') {
        values.push(value);
      }
    }
  });
  return values;
}

/**
 * Adds a reaction product section to the form.
 * @param {!Node} node Target ReactionOutcome node for the new product.
 * @return {!Node} The newly created node.
 */
function add(node) {
  const productNode = ord.reaction.addSlowly(
      '#outcome_product_template', $('.outcome_products', node));

  // Add live validation handling.
  ord.reaction.addChangeHandler(productNode, () => {
    validateProduct(productNode);
  });
  return productNode;
}

/**
 * Adds keys for defined analyses to the analysis selector.
 * @param {!Node} node Parent node containing ReactionOutcome data.
 * @param {!Node} analysisSelectorNode Node containing an analysis selector.
 */
function populateAnalysisSelector(node, analysisSelectorNode) {
  const outcomeNode = node.closest('.outcome');
  $('.outcome_analysis_name', outcomeNode).each(function() {
    const name = $(this).text();
    if (name) {
      $('.analysis_key_selector', analysisSelectorNode)
          .append('<option value="' + name + '">' + name + '</option>');
    }
  });
}

/**
 * Adds a ProductMeasurement section to the form.
 * @param {!Node} node Parent node for the ReactionProduct.
 * @return {!Node} The newly created node.
 */
function addMeasurement(node) {
  const measurementNode = ord.reaction.addSlowly(
      '#product_measurement_template',
      $('.product_measurement_repeated', node));
  populateAnalysisSelector(node, $(node, '.analysis_key_selector'));

  // Set up the radio buttons for the value type.
  const buttons = $('.product_measurement_value_type input', node);
  buttons.attr('name', 'product_measurements_' + radioGroupCounter++);
  buttons.change(function() {
    if (this.value === 'percentage' || this.value === 'float') {
      $('.product_measurement_pm', node).show();
      $('.product_measurement_precision', node).show();
    } else {
      $('.product_measurement_pm', node).hide();
      $('.product_measurement_precision', node).hide();
    }
  });

  // Add an empty compound node for the authentic standard.
  const authenticStandard = ord.compounds.add(measurementNode);
  const title = $('.h4', authenticStandard);
  title.text('Authentic Standard');

  // Add live validation handling.
  ord.reaction.addChangeHandler(measurementNode, () => {
    validateMeasurement(measurementNode);
  });
  return measurementNode;
}

/**
 * Adds and populates a ProductMeasurement section in the form.
 * @param {!Node} productNode The parent ReactionProduct node.
 * @param {!proto.ord.ProductMeasurement} measurement
 */
function loadMeasurement(productNode, measurement) {
  const node = addMeasurement(productNode);
  $('.analysis_key_selector', node).val(measurement.getAnalysisKey());
  ord.reaction.setSelector(
      $('.product_measurement_type', node), measurement.getType());
  $('.product_measurement_details', node).text(measurement.getDetails());
  ord.reaction.setOptionalBool(
      $('.product_measurement_uses_internal_standard', node),
      measurement.hasUsesInternalStandard() ?
          measurement.getUsesInternalStandard() :
          null);
  ord.reaction.setOptionalBool(
      $('.product_measurement_is_normalized', node),
      measurement.hasIsNormalized() ? measurement.getIsNormalized() : null);
  ord.reaction.setOptionalBool(
      $('.product_measurement_uses_authentic_standard', node),
      measurement.hasUsesAuthenticStandard() ?
          measurement.getUsesAuthenticStandard() :
          null);

  const authenticStandard = measurement.getAuthenticStandard();
  if (authenticStandard) {
    ord.compounds.loadIntoCompound(node, authenticStandard);
  }

  if (measurement.percentage) {
    $('input[value=\'percentage\']', node).prop('checked', true);
    $('.product_measurement_value', node).addClass('floattext');
    if (measurement.percentage.hasValue()) {
      $('.product_measurement_value', node)
          .text(measurement.percentage.getValue());
    }
    $('.product_measurement_precision', node).show();
    if (measurement.percentage.hasPrecision()) {
      $('.product_measurement_precision', node)
          .text(measurement.percentage.getPrecision());
    }
  } else if (measurement.floatValue) {
    $('input[value=\'float\']', node).prop('checked', true);
    $('.product_measurement_value', node).addClass('floattext');
    if (measurement.floatValue.hasValue()) {
      $('.product_measurement_value', node)
          .text(measurement.floatValue.getValue());
    }
    $('.product_measurement_precision', node).show();
    if (measurement.floatValue.hasPrecision()) {
      $('.product_measurement_precision', node)
          .text(measurement.floatValue.getPrecision());
    }
  } else if (measurement.stringValue) {
    $('input[value=\'string\']', node).prop('checked', true);
    $('.product_measurement_value', node).removeClass('floattext');
    if (measurement.getStringValue()) {
      $('.product_measurement_value', node).text(measurement.getStringValue());
    }
    $('.product_measurement_precision', node).hide();
  }

  const retentionTime = measurement.getRetentionTime();
  if (retentionTime) {
    ord.reaction.writeMetric(
        '.product_measurement_retention_time', retentionTime, node);
  }

  const massSpec = measurement.getMassSpecDetails();
  if (massSpec) {
    ord.reaction.setSelector(
        $('.product_measurement_mass_spec_type', node), massSpec.getType());
    $('.product_measurement_mass_spec_details', node)
        .text(massSpec.getDetails());
    ord.reaction.setOptionalBool(
        $('.product_measurement_mass_spec_tic_minimum_mz', node),
        massSpec.hasTicMinimumMz() ? measurement.getTicMinimumMz() : null);
    ord.reaction.setOptionalBool(
        $('.product_measurement_mass_spec_tic_maximum_mz', node),
        massSpec.hasTicMaximumMz() ? measurement.getTicMaximumMz() : null);
    // TODO: Add support for eic_masses.
  }

  const selectivity = measurement.getSelectivity();
  if (selectivity) {
    ord.reaction.setSelector(
        $('.product_measurement_selectivity_type', node),
        selectivity.getType());
    $('.product_measurement_selectivity_details', node)
        .text(selectivity.getDetails());
  }

  const wavelength = measurement.getWavelength();
  if (wavelength) {
    ord.reaction.writeMetric(
        '.product_measurement_wavelength', wavelength, node);
  }
}

/**
 * Fetches a ProductMeasurement defined in the form.
 * @param {!Node} node An element containing a ProductMeasurement.
 * @return {!proto.ord.ProductMeasurement}
 */
function unloadMeasurement(node) {
  const measurement = new proto.ord.ProductMeasurement();
  measurement.setAnalysisKey(
      ord.reaction.getSelector($('.analysis_key_selector', node)));
  measurement.setType(
      ord.reaction.getSelector($('.product_measurement_type', node)));
  measurement.setDetails($('.product_measurement_details', node).text());
  measurement.setUsesInternalStandard(ord.reaction.getOptionalBool(
      $('.product_measurement_uses_internal_standard', node)));
  measurement.setIsNormalized(ord.reaction.getOptionalBool(
      $('.product_measurement_is_normalized', node)));
  measurement.setUsesAuthenticStandard(ord.reaction.getOptionalBool(
      $('.product_measurement_uses_authentic_standard', node)));

  const authenticStandardNode =
      $('.product_measurement_authentic_standard', node);
  const compound = ord.compounds.unloadCompound(authenticStandardNode);
  if (!ord.reaction.isEmptyMessage(compound)) {
    measurement.setAuthenticStandard(compound);
  }

  if ($('.product_measurement_percentage', node).is(':checked')) {
    const value = parseFloat($('.product_measurement_value', node).text());
    if (!isNaN(value)) {
      measurement.percentage.setValue(value);
    }
    const precision =
        parseFloat($('.product_measurement_precision', node).text());
    if (!isNaN(precision)) {
      measurement.percentage.setPrecision(precision);
    }
  } else if ($('.product_measurement_float', node).is(':checked')) {
    const value = parseFloat($('.product_measurement_value', node).text());
    if (!isNaN(value)) {
      measurement.floatValue.setValue(value);
    }
    const precision =
        parseFloat($('.product_measurement_precision', node).text());
    if (!isNaN(precision)) {
      measurement.floatValue.setPrecision(precision);
    }
  } else if ($('.product_measurement_string', node).text()) {
    measurement.setStringValue($('.product_measurement_string', node).text());
  }

  const retentionTime = ord.reaction.readMetric(
      '.product_measurement_retention_time', new proto.ord.Time(), node);
  if (!ord.reaction.isEmptyMessage(retentionTime)) {
    measurement.setRetentionTime(retentionTime);
  }

  const massSpecDetails =
      new proto.ord.ProductMeasurement.MassSpecMeasurementDetails();
  massSpecDetails.setType(
      ord.reaction.getSelector($('.product_measurement_mass_spec_type', node)));
  massSpecDetails.setDetails(
      $('.product_measurement_mass_spec_details', node).text());
  massSpecDetails.setTicMinimumMz(ord.reaction.getOptionalBool(
      $('.product_measurement_mass_spec_tic_minimum_mz', node)));
  massSpecDetails.setTicMaximumMz(ord.reaction.getOptionalBool(
      $('.product_measurement_mass_spec_tic_maximum_mz', node)));
  // TODO: Add support for eic_masses.
  measurement.setMassSpecDetails(massSpecDetails);

  const selectivity = new proto.ord.ProductMeasurement.Selectivity();
  selectivity.setType(ord.reaction.getSelector(
      $('.product_measurement_selectivity_type', node)));
  selectivity.setDetails(
      $('.product_measurement_selectivity_details', node).text());
  measurement.setSelectivity(selectivity);

  const wavelength = ord.reaction.readMetric(
      '.product_measurement_wavelength', new proto.ord.Wavelength(), node);
  if (!ord.reaction.isEmptyMessage(wavelength)) {
    measurement.setWavelength(wavelength);
  }
  return measurement;
}

/**
 * Validates a ProductMeasurement defined in the form.
 * @param {!Node} node A node containing a ProductMeasurement.
 * @param {?Node} validateNode The target div for validation results.
 */
function validateMeasurement(node, validateNode) {
  const measurement = unloadMeasurement(node);
  ord.reaction.validate(measurement, 'ProductMeasurement', node, validateNode);
}

/**
 * Validates a product defined in the form.
 * @param {!Node} node A node containing a reaction product.
 * @param {?Node} validateNode The target div for validation results.
 */
function validateProduct(node, validateNode) {
  const product = unloadProduct(node);
  ord.reaction.validate(product, 'ReactionProduct', node, validateNode);
}
