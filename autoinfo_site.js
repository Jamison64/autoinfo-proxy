var Makes;
var VehicleDetails = {
  ReturnField: "",
  Make: "",
  Model: "",
  Year: "",
  Series: "",
  Chassis: "",
  SeriesChassis: "",
  Engine: "",
};

let messageData = {
  heightAdjust: 0,
  heightScroll: 0,
  cart: 0,
};

$(document).ready(function () {
  // -------general script
  messageData.adjust = $(document).height() + 100;

  window.parent.postMessage(messageData, "*");

  const resize_ob = new ResizeObserver(function (entries) {
    // since we are observing only a single element, so we access the first element in entries array
    let object = entries[0].contentRect;

    messageData.adjust = object.height + 100;
    if (messageData.adjust < messageData.scroll && object.width < 767)
      messageData.scroll = messageData.adjust;
    window.parent.postMessage(messageData, "*");
  });

  // start observing for resize
  resize_ob.observe(document.querySelector("body"));

  // -------vehicle search binding events
  $(document).on("click", "#search-plate", function (e) {
    let plate = $("#plate").val().replace(" ", "");
    let place = $("#place").val();
    if (ValidateRequiredFields(plate, place)) {
      PostPlateLicense(plate, place);
    }
  });

  $("#plate").keydown(function (e) {
    $("#forbidden-char-alert").addClass("hidden");
  });

  $("#plate").keyup(function (e) {
    var newValue = $(this).val();
    const regex = new RegExp(/[^a-zA-Z0-9]/g);
    if (regex.test(newValue)) {
      $(this).val(newValue.replace(regex, ""));
      $("#forbidden-char-alert").removeClass("hidden");
    }
  });

  $("#partnumber").keydown(function (e) {
    $("#forbidden-char-alert-partno").addClass("hidden");
  });

  $("#partnumber").keyup(function (e) {
    var newValue = $(this).val();
    const regex = new RegExp(/[^a-zA-Z0-9\-\/]/g);
    if (regex.test(newValue)) {
      $(this).val(newValue.replace(regex, ""));
      $("#forbidden-char-alert-partno").removeClass("hidden");
    }
  });

  $(document).on("click", "#reset-plate", function (e) {
    ResetVehicleSearchWidget();
  });

  //mark the clicked item as selected
  $(document).on("click", ".selectable", function () {
    $(this).siblings().removeClass("selected");
    if ($(this).hasClass("selected")) {
      //to prevent user from spamming or triggering the same selection twice
      return;
    }
    $(this).addClass("selected");
    var returnField = $(this).parent().data("next-field");
    if (returnField != "final-vehicle") {
      PostVehicleData(returnField);
    } else {
      let vehicleId = $(this).data("vehicle-id");
      let vehicleLongDescription = $(this).data("vehicle-long-description");
      SetVehicleFinalResult(vehicleId, vehicleLongDescription);
      $("#search-result-spinner").removeClass("hidden");
      SearchProducts(vehicleId, 0, 1);
    }
  });

  $(document).on("keyup", ".search", function () {
    let keyword = $(this).val();
    let target = $(this).data("target");
    let listOfMatches = [];

    if (keyword == "") {
      $(target)
        .children()
        .each(function () {
          $(this).removeClass("hidden");
        });
    } else {
      $(target)
        .children()
        .each(function () {
          let element = $(this).text().toLowerCase().trim();

          if (element.indexOf(keyword.toLowerCase()) == -1) {
            $(this).addClass("hidden");
          } else {
            if (listOfMatches.indexOf(element) != -1) {
              $(this).addClass("hidden");
            } else {
              $(this).removeClass("hidden");
            }
            listOfMatches.push(element);
          }
        });
    }
  });

  $(document).on("click", ".vehicle-page", function () {
    let page = $(this).data("page");
    ClearVehicleSearchResults();

    GetPage(page);
  });

  $(document).on("click", ".filter-option", function () {
    let filterOption = this;
    if ($(this).hasClass("selected")) {
      //to prevent user from spamming or triggering the same selection twice
      return;
    }
    ClearVehicleSearchResults();
    FilterBy(filterOption);
  });

  $(document).on("click", "#clear-select-list", function () {
    ResetVehicleSearchWidget();
  });

  PostVehicleData("make");

  $(document).on("click", ".add-to-cart", function () {
    let productId = $(this).data("product-id");
    let baseUrl = $(this).data("base-url");
    addToCart(baseUrl, productId, this);
  });

  // -------end vehicle search binding events

  // -------part number search binding events

  $(document).on("click", "#search-part-number", function (e) {
    ResetPartsNumberSearchResult();
    ResetVehicleFitmentsImage();
    let partNumber = $("#partnumber").val().replace(" ", "");

    if (partNumber != "") {
      $("#part-search-result-spinner").removeClass("hidden");
      PostPartNumber(partNumber, 1);
    } else {
      $("#part-number-alert").removeClass("hidden");
    }
  });

  $(document).on("click", ".select-part-button", function () {
    let productAAPI = $(this).data("gtin");
    GetVehicleFitmentImage(productAAPI);
  });

  $(document).on("click", "#reset-part-number", function () {
    ResetPartNumberSearchWidget();
  });

  $(document).on("click", ".part-number-page", function () {
    let page = $(this).data("page");
    GetPartNumberPage(page);
  });

  $(document).on("click", ".vehicle-fitment-pagination", function () {
    let way = $(this).attr("id");
    PaginateVehicleFitmentsImage(way);
  });

  // Set field values from query params if present
  const params = new URLSearchParams(window.location.search);
  let searchType = params.get("searchType");
  if (searchType === "regoSearch") {
    let plate = params.get("plate");
    $("#plate").val(plate);
    let place = params.get("place").toUpperCase();
    $("#place").val(place);
    waitForTurnstileToken().then((token) => {
      if (token) {
        $("#search-plate").click();
      }
    });
  }

  if (searchType === "partNumberSearch") {
    $("#nav-part-number-tab").click();
    let partNumber = params.get("partNumber");
    $("#partnumber").val(partNumber);
    waitForTurnstileToken().then((token) => {
      if (token) {
        $("#search-part-number").click();
      }
    });
  }
});

function PostVehicleData(returnField) {
  VehicleDetails.ReturnField = returnField;
  VehicleDetails.Make = $("#make .selected").text().trim();
  VehicleDetails.Model = $("#model .selected").text().trim();
  VehicleDetails.Year = $("#year .selected").text().trim();
  VehicleDetails.SeriesChassis = $("#seriesChassis .selected").text().trim();
  VehicleDetails.Engine = $("#engine .selected").text().trim();
  ClearSelectionFields(returnField);
  $("#" + returnField + "-spinner").removeClass("hidden");
  $.post(
    "/Home/VehicleQuery",
    { vehicleBase: VehicleDetails },
    function (data) {
      $("#" + returnField + "-filter").prop("disabled", false);
      for (let result of data) {
        let dataVehicle = "";
        if (returnField == "details") {
          dataVehicle =
            'data-vehicle-id = \"' +
            result.vehicleId +
            '\" data-vehicle-long-description=\"' +
            result.vehicleLongDescription +
            '\" ';
        }
        $("#" + returnField).append(
          '<p class="my-1 selectable ' +
            returnField +
            '" data-value="' +
            result.selectText +
            '" ' +
            dataVehicle +
            ">" +
            result.selectText +
            "</p>",
        );
      }

      scrollTo(returnField);
    },
  )
    .fail(function () {
      $("#vehicle-search-error").removeClass("hidden");
    })
    .done(function () {
      $("#" + returnField + "-spinner").addClass("hidden");
      $("#vehicle-search-error").addClass("hidden");
    });
}

function PostPlateLicense(plate, place) {
  HideVehicleSelectionFields();
  HideFinalVehicleResult();
  HideFinalVehicleOptions();
  HideSearchResult();
  HideFilterBar();
  EmptyVehicleProductsSearchResult();
  HideVehicleSearchAlerts();
  waitForTurnstileToken().then((token) => {
    $("#search-button-text").addClass("hidden");
    $("#search-button-spinner").removeClass("hidden");
    $.post(
      "/Home/VehicleByLicensePlateQuery",
      { plate: plate, place: place, "cf-turnstile-token": token },
      function (data) {
        if (data != null && data.length > 0) {
          if (data.length == 1) {
            SetVehicleFinalResult(
              data[0].vehicleId,
              data[0].vehicleLongDescription,
            );
            scrollTo("final-result");
            $("#search-result-spinner").removeClass("hidden");
            SearchProducts(data[0].vehicleId, 0, 1);
          }
          if (data.length > 1) {
            EmptyPlateResultOptions();
            for (let option of data) {
              $("#result-options").append(
                '<div class="selectable my-3 vehicle-option" role="alert" data-vehicle-id="' +
                  option.vehicleId +
                  '" data-vehicle-long-description="' +
                  option.vehicleLongDescription +
                  '">' +
                  option.vehicleLongDescription +
                  "</div >",
              );
            }
            DisplayFinalVehicleOptions();
          }
        } else {
          DisplayNoResultsAlert();
        }
      },
    )
      .fail(function (xhr, status, error) {
        $("#vehicle-search-error").removeClass("hidden");
      })
      .done(function () {
        $("#search-button-text").removeClass("hidden");
        $("#search-button-spinner").addClass("hidden");
      });
    turnstile.reset();
  });
}

function SearchProducts(vehicleId, filterSelected, page) {
  scrollTo("search-result-spinner");
  waitForTurnstileToken().then((token) => {
    $.post(
      "/Home/PartsQuery",
      {
        vehicleId: vehicleId,
        partGroup: filterSelected,
        page: page,
        "cf-turnstile-token": token,
      },
      function (data) {
        $("#vehicle-search-error").addClass("hidden");
        if (data != null && data.data.length > 0 && data !== undefined) {
          DisplayPartListResults(data.data);
          DisplayPagination(data.pagination);
          DisplayFilterBar(data.filtersAvailable);
          scrollTo("search-result");
        } else {
          DisplayNoPartsFound();
        }
      },
    )
      .fail(function () {
        $("#vehicle-search-error").removeClass("hidden");
      })
      .done(function () {
        $("#search-result-page-spinner").addClass("hidden");
        $("#search-result-spinner").addClass("hidden");
      });
    turnstile.reset();
  });
}

function HideVehicleSelectionFields() {
  $("#vehicle-selection").addClass("hidden");
}

function DisplayVehicleSelectionFields() {
  $("#vehicle-selection").removeClass("hidden");
}

function HideFinalVehicleResult() {
  $("#final-result").addClass("hidden");
}

function DisplayFinalVehicleResult() {
  $("#final-result").removeClass("hidden");
}

function HideNoPlateResult() {
  $("#no-plate-result").addClass("hidden");
}

function DisplayFinalVehicleOptions() {
  $("#multiple-results").removeClass("hidden");
}

function HideFinalVehicleOptions() {
  $("#multiple-results").addClass("hidden");
}

function EmptyVehicleProductsSearchResult() {
  $(".search-result-item").remove();
}

function HideErrorAlert() {
  $("#vehicle-search-error").addClass("hidden");
}

function SetVehicleFinalResult(vehicleId, vehicleLongDescription) {
  HideVehicleSelectionFields();
  HideFinalVehicleOptions();
  HideNoPlateResult();
  HideErrorAlert();
  $("#final-vehicle").text(vehicleLongDescription);
  $("#final-vehicle-id").val(vehicleId);
  DisplayFinalVehicleResult();
}

function ResetVehicleSearchWidget() {
  ResetPlateSearch();
  $("#vehicle-selection").removeClass("hidden");
  $(".select-list").not("#make").empty();
  EmptyPlateResultOptions();
  ResetFilters();
  ResetFinalVehicleResult();
  HideFinalVehicleResult();
  HideVehicleSearchAlerts();
  $(".make").removeClass("hidden").removeClass("selected");
  $("#make-filter").prop("disabled", false);
  $("#no-vehicle-parts-found").addClass("hidden");
  ResetSearchResultList();
  ClearFilter();
}

function ClearSelectionFields(returnField) {
  $("#" + returnField).empty();
  $("#" + returnField)
    .parent()
    .nextAll()
    .children(".search")
    .prop("disabled", true);
  $("#" + returnField)
    .parent()
    .nextAll()
    .children(".select-list")
    .empty();
  $("#" + returnField)
    .parent()
    .children(".search")
    .val(""); //clear the input of returnField
  $("#" + returnField)
    .parent()
    .nextAll()
    .children(".search")
    .val(""); //clear descendants input fields
  HideNoPlateResult();
  HideErrorAlert();
  HideFinalVehicleResult();
  ResetSearchResultList();
}

function ClearVehicleSearchResults() {
  $("#no-vehicle-parts-found").addClass("hidden");
  EmptyVehicleProductsSearchResult();
  HideVehiclePagination();
}

function DisplayNoResultsAlert() {
  $("#no-plate-result").removeClass("hidden");
}

function DisplayNoPartsFound() {
  ResetSearchResultList();
  $("#no-vehicle-parts-found").removeClass("hidden");
}

function EmptyPlateResultOptions() {
  $("#result-options").empty();
}

function ResetFinalVehicleResult() {
  $("#final-vehicle").text("");
}

function ResetFilters() {
  $(".search").val("");
  $(".search").prop("disabled", true);
}

function DisplaySearchResult() {
  $("#search-result").removeClass("hidden");
}

function DisplayFilterBar(filtersAvailable) {
  SetFilterVisibility(filtersAvailable);
}

function SetFilterVisibility(filtersAvailable) {
  var countFiltersAvailable = 5;

  if (!filtersAvailable.catchCans) {
    $(".filter-option#catch-cans").addClass("hidden");
    countFiltersAvailable--;
  }
  if (!filtersAvailable.filters) {
    $(".filter-option#filters").addClass("hidden");
    countFiltersAvailable--;
  }
  if (!filtersAvailable.beltsTensioners) {
    $(".filter-option#belts-tensioner").addClass("hidden");
    countFiltersAvailable--;
  }
  if (!filtersAvailable.oils) {
    $(".filter-option#oils").addClass("hidden");
    countFiltersAvailable--;
  }
  if (!filtersAvailable.accessories) {
    $(".filter-option#accessories").addClass("hidden");
    countFiltersAvailable--;
  }

  if (countFiltersAvailable == 1) {
    $(".filter-option#show-all").addClass("hidden");
  } else if (countFiltersAvailable > 1) {
    $("#search-filters").removeClass("hidden");
    $("#search-filters-mobile #filter-bar").removeClass("hidden");
  }
}

function HideSearchResult() {
  $("#search-result").addClass("hidden");
}

function HideFilterBar() {
  $("#search-filters").addClass("hidden");
}

function HideVehiclePagination() {
  $("#vehicle-search-pagination.pagination").addClass("hidden");
}

function HideVehicleSearchAlerts() {
  $("#nav-vehicle .alert").addClass("hidden");
}

function ClearFilter() {
  $(".filter-option").removeClass("selected");
  $(".filter-option").removeClass("hidden");
  $(".filter-option#show-all").addClass("selected");
}

function DisplayPartListResults(partsList) {
  ResetSearchResultList();
  DisplaySearchResult();

  for (let part of partsList) {
    let partRow = $(".search-result-item-sample").clone();
    $(".search-result-item-sample .part-image a").attr(
      "href",
      part.westernFiltersBaseUrl + "/products.php?productId=" + part.id,
    );
    $(".search-result-item-sample .part-image img").attr(
      "src",
      part.autoInfoImgURL,
    );

    $(".search-result-item-sample .part-code").html(part.sku);

    let description = part.name;
    if (part.autoInfoFootNote != null && part.autoInfoFootNote.trim() != "") {
      description += " - " + part.autoInfoFootNote.trim();
    }
    if (
      part.autoInfoLongFootNote != null &&
      part.autoInfoLongFootNote.trim() != ""
    ) {
      description += " - " + part.autoInfoLongFootNote.trim();
    }

    $(".search-result-item-sample .part-note").text(description);
    $(".search-result-item-sample .part-price .part-price-value").text(
      part.price.toFixed(2),
    );
    if (part.availability.toLowerCase().trim() == "available") {
      $(".search-result-item-sample .part-status").text(
        "Please call to check for availability",
      );
      $(".search-result-item-sample .part-add-to-cart button").data(
        "base-url",
        part.westernFiltersBaseUrl,
      );
      $(".search-result-item-sample .part-add-to-cart button").data(
        "product-id",
        part.id,
      );
    } else {
      $(".search-result-item-sample .part-status").text(
        part.availability.toLowerCase(),
      );
      $(".search-result-item-sample .part-add-to-cart button").addClass(
        "hidden",
      );
    }
    $(".search-result-item-sample").removeClass("hidden");
    $(".search-result-item-sample").addClass("search-result-item");
    $(".search-result-item-sample").removeClass("search-result-item-sample");

    $("#search-result-list").append(partRow);
  }
}

function DisplayPagination(pagination) {
  if (pagination != null) {
    $(".vehicle-search-page").remove();

    if (pagination.startPage > 1) {
      $("#first a").data("page", 1);
      $("#first").removeClass("disabled");
    }
    if (pagination.endPage < pagination.totalPages) {
      $("#last a").data("page", pagination.totalPages);
      $("#last").removeClass("disabled");
    }
    if (pagination.startPage != pagination.endPage) {
      for (var i = pagination.startPage; i <= pagination.endPage; i++) {
        let paginationItem = "";
        if (i == pagination.currentPage) {
          paginationItem =
            '<li class="page-item vehicle-search-page active"><a data-page="' +
            i +
            '" class="page-link vehicle-page" >' +
            i +
            "</a></li>";
        } else {
          paginationItem =
            '<li class="page-item vehicle-search-page "><a data-page="' +
            i +
            '" class="page-link vehicle-page" >' +
            i +
            "</a></li>";
        }

        $(paginationItem).insertBefore("#last");
      }
    } else {
      paginationItem =
        '<li class="page-item vehicle-search-page active"><a data-page="' +
        pagination.currentPage +
        '" class="page-link vehicle-page " >' +
        pagination.currentPage +
        "</a></li>";
      $(paginationItem).insertAfter("#first");
    }
  }

  $(".pagination").removeClass("hidden");
}

function ValidateRequiredFields(plate, place) {
  var validated = true;
  if (plate === undefined || plate.trim() == "") {
    $("#plate-alert").removeClass("hidden");
    validated = false;
  } else {
    if (!$("#plate-alert").hasClass("hidden")) {
      $("#plate-alert").addClass("hidden");
    }
  }
  if (place === undefined || place.trim() == "") {
    $("#place-alert").removeClass("hidden");
    validated = false;
  } else {
    if (!$("#place-alert").hasClass("hidden")) {
      $("#place-alert").addClass("hidden");
    }
  }

  return validated;
}

function FilterBy(filterOption) {
  let vehicleId = $("#final-vehicle-id").val();
  $(".filter-option").removeClass("selected");
  $(filterOption).addClass("selected");
  let filterSelected = $(filterOption).data("option");
  $("#search-result-page-spinner").removeClass("hidden");
  SearchProducts(vehicleId, filterSelected, 1);
}

function GetPage(page) {
  let vehicleId = $("#final-vehicle-id").val();
  let filterSelected = $(".filter-option.selected").data("option");
  $("#search-result-page-spinner").removeClass("hidden");
  SearchProducts(vehicleId, filterSelected, page);
}

function ResetSearchResultList() {
  HideSearchResult();
  HideVehiclePagination();
  HideFilterBar();
  $("#no-vehicle-parts-found").addClass("hidden");
  EmptyVehicleProductsSearchResult();
  $("#part-search-page-result-spinner").addClass("hidden");
  $("#search-result-spinner").addClass("hidden");
}

function ResetPlateSearch() {
  $("#place-alert").addClass("hidden");
  $("#plate-alert").addClass("hidden");
  $("#plate").val("");
  $("#place option").first().prop("selected", true);
}

function addToCart(baseUrl, productId, addToCartButton) {
  $(addToCartButton).find(".add-to-cart-text").addClass("hidden");
  $(addToCartButton).find(".add-to-cart-button-spinner").removeClass("hidden");

  $.ajax({
    url: baseUrl + "/cart.php?action=add&product_id=" + productId,
    method: "GET",
    crossDomain: true,
    credentials: "same-origin",
    dataType: "script",
    complete: function () {
      $(addToCartButton).find(".add-to-cart-text").removeClass("hidden");
      $(addToCartButton).find(".add-to-cart-button-spinner").addClass("hidden");

      $(addToCartButton).popover({
        content: "Added to cart",
        placement: "bottom",
      });
      $(addToCartButton).popover("show");

      messageData.cart++;
      window.parent.postMessage(messageData, "*");
      messageData.cart--;

      setTimeout(function () {
        $(addToCartButton).popover("dispose");
      }, 2000);
    },
  });
}

function scrollTo(id) {
  var tag = $("#" + id);

  if ($("html").width() < 767) messageData.scroll = tag.offset().top;

  window.parent.postMessage(messageData, "*");
}
//**********************************************************
//
//      part number search functions
//
//**********************************************************
function PostPartNumber(partNumber, page) {
  HidePartNumberSearchAlerts();

  waitForTurnstileToken().then((token) => {
    $("#part-search-page-result-spinner").removeClass("hidden");
    $.post(
      "/Home/PartNumberSearch",
      { partNumber: partNumber, page: page, "cf-turnstile-token": token },
      function (data) {
        if (data != null && data.data.length > 0 && data !== undefined) {
          DisplayPartsFound(data.data);
          DisplayPartNumberPagination(data.pagination);
        } else {
          DisplayPartsNotFound();
        }
      },
    )
      .fail(function () {
        $("#part-search-error").removeClass("hidden");
      })
      .done(function () {
        $("#part-search-result-spinner").addClass("hidden");
        $("#part-search-page-result-spinner").addClass("hidden");
      });
    turnstile.reset();
  });
}

function DisplayPartsFound(parts) {
  HidePartNumberSearchAlerts();
  ResetPartSearchResultListVisibility();
  ClearPartSearchResult();
  $("#part-search-result-list").removeClass("hidden");
  for (let part of parts) {
    let partRow = $(".part-search-result-item-sample").clone();
    $(".part-search-result-item-sample .part-image a").attr(
      "href",
      part.westernFiltersBaseUrl + "/products.php?productId=" + part.id,
    );
    $(".part-search-result-item-sample .part-image img").attr(
      "src",
      part.autoInfoImgURL,
    );

    $(".part-search-result-item-sample .part-code").html(part.sku);

    let description = part.name;
    if (part.autoInfoFootNote != null && part.autoInfoFootNote.trim() != "") {
      description += " - " + part.autoInfoFootNote.trim();
    }
    if (
      part.autoInfoLongFootNote != null &&
      part.autoInfoLongFootNote.trim() != ""
    ) {
      description += " - " + part.autoInfoLongFootNote.trim();
    }

    $(".part-search-result-item-sample .part-note").text(description);
    $(".part-search-result-item-sample .part-price .part-price-value").text(
      part.price.toFixed(2),
    );
    $(
      ".part-search-result-item-sample .part-add-to-cart .select-part-button",
    ).data("gtin", part.bin_picking_number);
    if (part.availability.toLowerCase().trim() == "available") {
      $(".part-search-result-item-sample .part-status").text(
        "Please call to check for availability",
      );
      $(".part-search-result-item-sample .part-add-to-cart button").data(
        "base-url",
        part.westernFiltersBaseUrl,
      );
      $(".part-search-result-item-sample .part-add-to-cart button").data(
        "product-id",
        part.id,
      );
    } else {
      $(".part-search-result-item-sample .part-status").text(
        part.availability.toUpperCase(),
      );
      $(".part-search-result-item-sample .part-add-to-cart button").addClass(
        "hidden",
      );
    }
    $(".part-search-result-item-sample").removeClass("hidden");
    $(".part-search-result-item-sample").addClass("part-search-result-item");
    $(".part-search-result-item-sample").removeClass(
      "part-search-result-item-sample",
    );

    $("#part-search-result-list").append(partRow);
  }
  $("#part-search-result").removeClass("hidden");
}

function DisplayPartsNotFound() {
  $("#no-part-found").removeClass("hidden");
}

function ResetPartSearchResultListVisibility() {
  $("#part-search-result").addClass("hidden");
}

function HidePartNumberSearchAlerts() {
  $("#nav-part-number .alert").addClass("hidden");
}

function GetVehicleFitmentImage(productAAPI) {
  HidePartNumberSearchAlerts();
  ResetVehicleFitment();

  waitForTurnstileToken().then((token) => {
    $("#vehicle-fitments-spinner").removeClass("hidden");
    $.post(
      "Home/VehicleByPart",
      { partAAPI: productAAPI, "cf-turnstile-token": token },
      function (data) {
        DisplayVehicleFitment();
        for (var image of data.vehiclesImages) {
          if (image != null) {
            $("#vehicle-fitments-images").append(
              '<img class="hidden vehicle-fitment-image img-fluid" src="' +
                image.vehiclesImageUrl +
                '"/>',
            );
          }
        }
        if (data.vehiclesImages.length >= 2) {
          scrollTo("vehicle-fitment");
          $(".vehicle-fitment-image").first().removeClass("hidden");
        }
        if (data.vehiclesImages.length > 2) {
          $("#vehicle-fitment-pagination").removeClass("hidden");
        }
        if (data.vehiclesImages.length < 2) {
          $("#no-vehicle-fitments-found").removeClass("hidden");
        }
      },
    )
      .fail(function () {
        $("#part-search-error").removeClass("hidden");
      })
      .done(function () {
        $("#vehicle-fitments-spinner").addClass("hidden");
      });
    turnstile.reset();
  });
}

function ResetPartNumberSearchWidget() {
  $("#partnumber").val("");
  HidePartNumberSearchAlerts();
  ResetPartsNumberSearchResult();
  ResetVehicleFitmentsImage();
}

function ResetPartsNumberSearchResult() {
  $("#part-search-result").addClass("hidden");
  $(".part-search-result-item").remove();
  $(".page-item-number").remove();
}

function ResetVehicleFitmentsImage() {
  $("#vehicle-fitment").addClass("hidden");
  $("#vehicle-fitment-pagination").addClass("hidden");
  ClearVehicleFitmentResult();
}

function ResetVehicleFitment() {
  $(".vehicle-fitment-image").remove();
  $("#vehicle-fitment").addClass("hidden");
}

function DisplayVehicleFitment() {
  $("#vehicle-fitment").removeClass("hidden");
}

function DisplayPartNumberPagination(pagination) {
  if (pagination != null) {
    $(".page-item-number").remove();

    if (pagination.startPage > 1) {
      $("#first-part-number-page a.part-number-page").data("page", 1);
      $("#first-part-number-page").removeClass("hidden");
    } else {
      $("#first-part-number-page").addClass("hidden");
    }
    if (pagination.endPage < pagination.totalPages) {
      $("#last-part-number-page a.part-number-page").data(
        "page",
        pagination.totalPages,
      );
      $("#last-part-number-page").removeClass("hidden");
    } else {
      $("#last-part-number-page").addClass("hidden");
    }
    if (pagination.startPage != pagination.endPage) {
      for (var i = pagination.startPage; i <= pagination.endPage; i++) {
        let paginationItem = "";
        if (i == pagination.currentPage) {
          paginationItem =
            '<li class="page-item page-item-number active"><a data-page="' +
            i +
            '" class="page-link page part-number-page" >' +
            i +
            "</a></li>";
        } else {
          paginationItem =
            '<li class="page-item page-item-number "><a data-page="' +
            i +
            '" class="page-link page part-number-page" >' +
            i +
            "</a></li>";
        }

        $(paginationItem).insertBefore("#last-part-number-page");
      }
    } else {
      paginationItem =
        '<li class="page-item page-item-number active"><a data-page="' +
        pagination.currentPage +
        '" class="page-link part-number-page page" >' +
        pagination.currentPage +
        "</a></li>";
      $(paginationItem).insertAfter("#first-part-number-page");
    }
  }
}

function GetPartNumberPage(page) {
  ResetVehicleFitmentsImage();
  ClearPartSearchResult();

  let partNumber = $("#partnumber").val().replace(" ", "");

  if (partNumber != "") {
    PostPartNumber(partNumber, page);
  } else {
    $("#part-number-alert").removeClass("hidden");
  }
}

function ClearPartSearchResult() {
  $(".part-search-result-item").remove();
}

function ClearVehicleFitmentResult() {
  $(".vehicle-fitment-image").remove();
}

function PaginateVehicleFitmentsImage(way) {
  $("#first-vehicle-fitment-page").removeClass("disabled");
  $("#last-vehicle-fitment-page").removeClass("disabled");

  let currentImage = $(".vehicle-fitment-image").not(".hidden");
  if (way == "next") {
    let nextImage = $(currentImage).next();
    if ($(nextImage).hasClass("vehicle-fitment-image")) {
      $(currentImage).addClass("hidden");
      $(nextImage).removeClass("hidden");
    }
  } else {
    let prevImage = $(currentImage).prev();
    if ($(prevImage).hasClass("vehicle-fitment-image")) {
      $(currentImage).addClass("hidden");
      $(prevImage).removeClass("hidden");
    }
  }
  let newCurrentImage = $(".vehicle-fitment-image").not(".hidden");
  if (!newCurrentImage.next().hasClass("vehicle-fitment-image")) {
    $("#last-vehicle-fitment-page").addClass("disabled");
  }
  if (!newCurrentImage.prev().hasClass("vehicle-fitment-image")) {
    $("#first-vehicle-fitment-page").addClass("disabled");
  }
}

function getTurnstileToken() {
  if (turnstile.isExpired()) {
    turnstile.reset();
  }
  let token = turnstile.getResponse();
  if (token) {
    return token;
  }
  return null;
}

async function waitForTurnstileToken() {
  let attempts = 0;
  let token = getTurnstileToken();
  while (token == null && attempts < 5) {
    await new Promise((r) => setTimeout(r, 500));
    attempts++;
    token = getTurnstileToken();
  }
  return token;
}
