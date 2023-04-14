//provide access token to Mapbox API 
mapboxgl.accessToken = 'pk.eyJ1IjoiaXJlbyIsImEiOiJjbGRtMTVrbGkwNHh5M3B0Yjd5YnF3cHNvIn0.KNtbmsY84dCZpXiXy91keg';

//define maximum and minimum scroll bounds for the map
const maxBounds = [
  [-82, 42.94], //SW coords
  [-77, 44.87] //NE coords
];

//define a constant variable "map" and assign it to a map created with the Mapbox API 
const map = new mapboxgl.Map({
  container: 'map1', //ID for div where map will be embedded in HTML file
  style: 'mapbox://styles/ireo/clfvlsqn800m701mxbykznqv5', //link to style URL
  center: [-79.266, 43.926], //starting position [longitude, latitude]
  zoom: 8.65, //starting zoom
  bearing: -17.7, //angle rotation of map
  maxBounds: maxBounds //maximum and minimum scroll bounds
});

//add zoom and rotation controls to the map
map.addControl(new mapboxgl.NavigationControl());

//add fullscreen option to the map
map.addControl(new mapboxgl.FullscreenControl());

//assign 'geocoder' variable to a Mapbox geocoder (which allows searching of locations and zooming into searched locations on the map)
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  countries: "ca" //limit searchable locations to being within Canada
});

//add geocoder to map by embedding it within HTML element with "geocoder" id (such that its map location and style is specified by the css of the latter)
document.getElementById('geocoder').appendChild(geocoder.onAdd(map));

//initialize global 'isProcessing' variable which is used to avoid triggering events multiple times
isProcessing = false

//initialize empty FeatureCollection objects 'geojson' and 'buffresult' which will hold user-clicked point and surrounding buffer features from the planner tool 
let geojson = {
  'type': 'FeatureCollection',
  'features': []
};

let buffresult = {
  "type": "FeatureCollection",
  "features": []
};

//specify events triggered by the loading of the "map" variable
map.on('load', () => {

  //retrieve external JSON file for BikeShare stations from Toronto BikeShare API
  fetch('https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_information')
  .then(response => response.json())
  .then(response => {
    data = response; //assign variable "data" to BikeShare stations JSON file from Toronto BikeShare API
    updateMap(data) //call updateMap function only when JSON file is done being fetched (since fetch is asynchronous)
  });
  
  //create 'updateMap' function for taking the coordinates out of the BikeShare stations JSON file, using them to manually create a GeoJSON file, and then plotting the station points of this created GeoJSON file 
  function updateMap(data) {

    test = []; //assign global 'test' variable to empty list
    //loop through all of the BikeShare stations
    for (let step = 0; step < data.data.stations.length; step++) {
      let longitude = data.data.stations[step].lon
      let latitude = data.data.stations[step].lat
      let name = data.data.stations[step].name
      let station_id = data.data.stations[step].station_id
      let address = data.data.stations[step].address
      let post_code = data.data.stations[step].post_code
      //append each BikeShare station's coordinates and properties (name, id, address, and postal code) - specified in a geojson 'Feature' format - to the list "test"
      test.push(JSON.parse(`{"type": "Feature", "geometry": {"coordinates": [${longitude},${latitude}], "type": "Point"}, "properties": {"name":"${name}", "station_id":"${station_id}", "address":"${address}", "post_code":"${post_code}"}}`));
    };

    //add a geojson file source "toronto_bikeshare_stations" for Toronto BikeShare stations that is manually created using the "test" list
    map.addSource('toronto_bikeshare_stations', {
      type: 'geojson',
      data: {
        "type": "FeatureCollection",
        "features": test
      },
      //cluster the data to limit the symbology on the map at low zoom levels
      cluster: true,
      clusterMaxZoom: 14, //maximum zoom at which points cluster
      clusterRadius: 50 //distance over which points cluster
    });

    //load and add image 'bikeshare-marker' for bikeshare icons (throw an error if this process fails)
    map.loadImage(
      'https://ireo00.github.io/472-Resources/bikeshare.png',
      (error, image) => {
        if (error) throw error;
        map.addImage('bikeshare-marker', image);
      }
    );

    //add and style a layer of circles "toronto_bikeshare_clustered" from the defined "toronto_bikeshare_stations" source for the clustered bikeshare stations
    map.addLayer({
      'id': 'toronto_bikeshare_clustered',
      'type': 'circle',
      'source': 'toronto_bikeshare_stations',
      //only show cluster when there is more than 1 bikeshare station within radius 
      filter: ['has', 'point_count'],
      'paint': {
        //specify the radius of the circles based on whether the number of bikeshare stations within radius is <10, 10-20, 20-50, 50-100 or >100
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          13,
          10,
          15,
          20,
          17,
          50,
          20,
          100,
          25
        ],
        'circle-color': '#147453'
      }
    });

    //add and style a layer of symbols "toronto_bikeshare_cluster_count" from the defined "toronto_bikeshare_stations" source for the text on top of the clustered bikeshare stations
    map.addLayer({
      id: 'toronto_bikeshare_cluster_count',
      type: 'symbol',
      source: 'toronto_bikeshare_stations',
      //only show text when there is more than 1 bikeshare station within radius 
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
        //allow overlap of other text layers (so that all layers are simultaneously visible)
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: {
        'text-color': 'white'
      },
    });

    //add and style a layer of symbols "toronto_bikeshare_unclustered" from the defined "toronto_bikeshare_stations" source for the unclustered (single) bikeshare stations
    map.addLayer({
      id: 'toronto_bikeshare_unclustered',
      type: 'symbol',
      source: 'toronto_bikeshare_stations',
      //only show symbols when there is 1 bikeshare station within radius 
      filter: ['!', ['has', 'point_count']],
      layout: {
        //specify the image to be used as the symbols
        'icon-image': 'bikeshare-marker',
        'icon-size': 0.09,
        //allow overlap of other icon layers (so that all layers are simultaneously visible)
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });

  }

  //change cursor to a pointer when mouse hovers over 'toronto_bikeshare_unclustered' layer
  map.on('mouseenter', 'toronto_bikeshare_unclustered', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'toronto_bikeshare_unclustered' layer
  map.on('mouseleave', 'toronto_bikeshare_unclustered', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'toronto_bikeshare_unclustered' layer
  map.on('click', 'toronto_bikeshare_unclustered', (e) => {
    //assign variables to properties of clicked bikeshare station
    let station_id=e.features[0].properties.station_id
    let name=e.features[0].properties.name
    let address=e.features[0].properties.address
    let post_code=e.features[0].properties.post_code
    //retrieve external JSON file for BikeShare station status information from Toronto BikeShare API
    fetch('https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_status')
    .then(response => response.json())
    .then(response => {
      bikeshare_status = response; //assign variable "bikeshare_status" to BikeShare station status information JSON file from Toronto BikeShare API
      //loop through all of the BikeShare stations in the BikeShare station status information JSON file
      bikeshare_status.data.stations.forEach((station) => {
        //enter conditional if the id of the BikeShare station in the BikeShare station status information JSON file matches the id of the clicked bikeshare station
        if (station.station_id === station_id) {
          //if the postal code is not undefined, declare and add to map a popup at the longitude-latitude location of click which contains the postal code
          if (post_code!="undefined"){
            new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML("<b>Name:</b> " + name + "<br>" + "<b>Address:</b> " + address + "<br>" + "<b>Postal Code:</b> " + post_code + "<br>" + "<b>No. Available Bikes:</b> " + station.num_bikes_available + "<br>" + "<b>No. Available Docks:</b> " + station.num_docks_available)
            .addTo(map);
          }
          //if the postal code is undefined, declare and add to map a popup at the longitude-latitude location of click which does not contain the postal code
          else if (post_code=="undefined") {
            new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML("<b>Name:</b> " + name + "<br>" + "<b>Address:</b> " + address + "<br>" + "<b>No. Available Bikes:</b> " + station.num_bikes_available + "<br>" + "<b>No. Available Docks:</b> " + station.num_docks_available)
            .addTo(map);
          }
        }
      });
    });
  });

  //add a geojson file source "toronto_cycling_network" for Toronto bikeways
  map.addSource('toronto_cycling_network', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/toronto_cycling_network.geojson', 
    'generateId': true
  });

  //add and style a layer of lines "toronto_bikeways" from the defined "toronto_cycling_network" source
  map.addLayer({
    'id': 'toronto_bikeways',
    'type': 'line',
    'source': 'toronto_cycling_network',
    'paint': {
      'line-width': 3,
      //specify the color of the lines based on the text contained within the "Classification" data field (i.e. based on the bikeway type)
      //note that 'downcase' is used to ignore the case of the entries in the field 'Classification' (some entries are uppercase so we make them lowercase)
      'line-color': [
        'case',
        ['==', 'bike lane', ['downcase', ['get', 'Classification']]],
        '#FC6468',
        ['==', 'cycle track', ['downcase', ['get', 'Classification']]],
        '#FFB900',
        ['==', 'multi-use trail', ['downcase', ['get', 'Classification']]],
        '#0072B2',
        ['==', 'sharrows', ['downcase', ['get', 'Classification']]],
        '#8B4DAB',
        ['==', 'hiking/park trail', ['downcase', ['get', 'Classification']]],
        '#009E73',
        ['==', 'paved shoulder', ['downcase', ['get', 'Classification']]],
        '#C11F73',
        'black'
      ],
      //modify the opacity of lines based on the hover feature-state (i.e. change opacity of lines when hovered over)
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, //change opacity of lines to 1 when hovered over
        0.5 //leave opacity of lines at 0.5 when not hovered over
      ]
    }
  });

  //change cursor to a pointer when mouse hovers over 'toronto_bikeways' layer
  map.on('mouseenter', 'toronto_bikeways', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'toronto_bikeways' layer
  map.on('mouseleave', 'toronto_bikeways', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'toronto_bikeways' layer
  map.on('click', 'toronto_bikeways', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click 
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Name:</b> " + e.features[0].properties.name + "<br>" + "<b>Facility 1:</b> " + e.features[0].properties.type +  "<br>" + "<b>Classification:</b> " + e.features[0].properties.Classification
    + "<br>" + "<b>Facility 2:</b> " + e.features[0].properties.secondary_type) 
    .addTo(map);
  });

  let toronto_bikeID = null; //assign initial value of 'toronto_bikeID' variable as null

  //specify events triggered by moving mouse over the 'toronto_bikeways' layer
  map.on('mousemove', 'toronto_bikeways', (e) => {
    //enter conditional if mouse hovers over at least one feature of the 'toronto_bikeways' layer
    if (e.features.length > 0) { 
      //if toronto_bikeID IS NOT NULL - i.e. a feature was being hovered over immediately prior to another - set hover feature-state of this feature back to false to reset its original opacity (before continuing to move and highlight the next hovered line)
      if (toronto_bikeID !== null) { 
        map.setFeatureState(
          { source: 'toronto_cycling_network', id: toronto_bikeID },
          { hover: false }
        );
      }
      //set 'toronto_bikeID' variable to the id of the 'toronto_bikeways' layer feature being hovered over
      toronto_bikeID = e.features[0].id; 
      //change the hover feature-state to "true" for the feature of the 'toronto_bikeways' layer being hovered over (to change its opacity)
      map.setFeatureState(
        { source: 'toronto_cycling_network', id: toronto_bikeID },
        { hover: true } 
      );
    }
  });

  //specify events triggered by mouse leaving the 'toronto_bikeways' layer
  map.on('mouseleave', 'toronto_bikeways', () => { 
    //change the hover feature-state to "false" for the feature of the 'toronto_bikeways' layer that was previously hovered over (to reset its original opacity) and re-initialize toronto_bikeID to null
    if (toronto_bikeID !== null) {
      map.setFeatureState(
        { source: 'toronto_cycling_network', id: toronto_bikeID },
        { hover: false }
      );
    }
    toronto_bikeID = null;
  });   

  //add a geojson file source "york_region_cycling_network" for York Region bikeways
  map.addSource('york_region_cycling_network', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/york_region_cycling_network.geojson', 
    'generateId': true
  });

  //add and style a layer of lines "york_region_bikeways" from the defined "york_region_cycling_network" source
  map.addLayer({
    'id': 'york_region_bikeways',
    'type': 'line',
    'source': 'york_region_cycling_network',
    'paint': {
      'line-width': 3,
      //specify the color of the lines based on the text contained within the "Classification" data field (i.e. based on the bikeway type)
      //note that 'downcase' is used to ignore the case of the entries in the field 'Classification' (some entries are uppercase so we make them lowercase)
      'line-color': [
        'case',
        ['==', 'bike lane', ['downcase', ['get', 'Classification']]],
        '#FC6468',
        ['==', 'cycle track', ['downcase', ['get', 'Classification']]],
        '#FFB900',
        ['==', 'multi-use trail', ['downcase', ['get', 'Classification']]],
        '#0072B2',
        ['==', 'sharrows', ['downcase', ['get', 'Classification']]],
        '#8B4DAB',
        ['==', 'hiking/park trail', ['downcase', ['get', 'Classification']]],
        '#009E73',
        ['==', 'paved shoulder', ['downcase', ['get', 'Classification']]],
        '#C11F73',
        'black'
      ],
       //modify the opacity of lines based on the hover feature-state (i.e. change opacity of lines when hovered over)
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, //change opacity of lines to 1 when hovered over
        0.5 //leave opacity of lines at 0.5 when not hovered over
      ]
    }
  });

  let york_bikeID = null; //assign initial value of 'york_bikeID' variable as null

  //specify events triggered by moving mouse over the 'york_region_bikeways' layer
  map.on('mousemove', 'york_region_bikeways', (e) => {
    //enter conditional if mouse hovers over at least one feature of the 'york_region_bikeways' layer
    if (e.features.length > 0) { 
      //if york_bikeID IS NOT NULL - i.e. a feature was being hovered over immediately prior to another - set hover feature-state of this feature back to false to reset its original opacity (before continuing to move and highlight the next hovered line)
      if (york_bikeID !== null) { 
        map.setFeatureState(
          { source: 'york_region_cycling_network', id: york_bikeID },
          { hover: false }
        );
      }
      //set 'york_bikeID' variable to the id of the 'york_region_bikeways' layer feature being hovered over
      york_bikeID = e.features[0].id; 
      //change the hover feature-state to "true" for the feature of the 'york_region_bikeways' layer being hovered over (to change its opacity)
      map.setFeatureState(
        { source: 'york_region_cycling_network', id: york_bikeID },
        { hover: true } 
      );
    }
  });

  //specify events triggered by mouse leaving the 'york_region_bikeways' layer
  map.on('mouseleave', 'york_region_bikeways', () => { 
    //change the hover feature-state to "false" for the feature of the 'york_region_bikeways' layer that was previously hovered over (to reset its original opacity) and re-initialize york_bikeID to null
    if (york_bikeID !== null) {
      map.setFeatureState(
        { source: 'york_region_cycling_network', id: york_bikeID },
        { hover: false }
      );
    }
    york_bikeID = null;
  });   


  //change cursor to a pointer when mouse hovers over 'york_region_bikeways' layer
  map.on('mouseenter', 'york_region_bikeways', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'york_region_bikeways' layer
  map.on('mouseleave', 'york_region_bikeways', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'york_region_bikeways' layer
  map.on('click', 'york_region_bikeways', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Name:</b> " + e.features[0].properties.name + "<br>" + "<b>Facility:</b> " + e.features[0].properties.type + "<br>" + "<b>Classification:</b> " + e.features[0].properties.Classification +
    "<br>" + "<b>Surface:</b> " + e.features[0].properties.surface + "<br>" + "<b>Municipality:</b> " +  e.features[0].properties.municipality ) //if statement needed for "systems"
    .addTo(map);
  });

  //add a geojson file source "peel_region_cycling_network" for Peel Region bikeways
  map.addSource('peel_region_cycling_network', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/peel_region_cycling_network.geojson', 'generateId': true 
  });

  //add and style a layer of lines "peel_bikeways" from the defined "peel_region_cycling_network" source
  map.addLayer({
    'id': 'peel_bikeways',
    'type': 'line',
    'source': 'peel_region_cycling_network',
    'paint': {
      'line-width': 3,
      //specify the color of the lines based on the text contained within the "Classification" data field (i.e. based on the bikeway type)
      //note that 'downcase' is used to ignore the case of the entries in the field 'Classification' (some entries are uppercase so we make them lowercase)
      'line-color': [
        'case',
        ['==', 'bike lane', ['downcase', ['get', 'Classification']]],
        '#FC6468',
        ['==', 'cycle track', ['downcase', ['get', 'Classification']]],
        '#FFB900',
        ['==', 'multi-use trail', ['downcase', ['get', 'Classification']]],
        '#0072B2',
        ['==', 'sharrows', ['downcase', ['get', 'Classification']]],
        '#8B4DAB',
        ['==', 'hiking/park trail', ['downcase', ['get', 'Classification']]],
        '#009E73',
        ['==', 'paved shoulder', ['downcase', ['get', 'Classification']]],
        '#C11F73',
        'black'
      ],
      //modify the opacity of lines based on the hover feature-state (i.e. change opacity of lines when hovered over)
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, //change opacity of lines to 1 when hovered over
        0.5 //leave opacity of lines at 0.5 when not hovered over
      ]
    }
  });

  //change cursor to a pointer when mouse hovers over 'peel_bikeways' layer
  map.on('mouseenter', 'peel_bikeways', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'peel_bikeways' layer
  map.on('mouseleave', 'peel_bikeways', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'peel_bikeways' layer
  map.on('click', 'peel_bikeways', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML("<b>Name:</b> " + e.features[0].properties.Name + "<br>" + "<b>Facility:</b> " + e.features[0].properties.Type + "<br>" + "<b>Classification:</b> " +  e.features[0].properties.Classification +
      "<br>" + "<b>Surface:</b> " + e.features[0].properties.Surface + "<br>" + "<b>Municipality:</b> " +  e.features[0].properties.Municipality) //if statement needed
      .addTo(map);
  });

  let peel_bikeID = null; //assign initial value of 'peel_bikeID' variable as null

  //specify events triggered by moving mouse over the 'peel_bikeways' layer
  map.on('mousemove', 'peel_bikeways', (e) => {
    //enter conditional if mouse hovers over at least one feature of the 'peel_bikeways' layer
    if (e.features.length > 0) { 
      //if peel_bikeID IS NOT NULL - i.e. a feature was being hovered over immediately prior to another - set hover feature-state of this feature back to false to reset its original opacity (before continuing to move and highlight the next hovered line)
      if (peel_bikeID !== null) { 
        map.setFeatureState(
          { source: 'peel_region_cycling_network', id: peel_bikeID },
          { hover: false }
        );
      }
      //set 'peel_bikeID' variable to the id of the 'peel_bikeways' layer feature being hovered over
      peel_bikeID = e.features[0].id; 
      //change the hover feature-state to "true" for the feature of the 'peel_bikeways' layer being hovered over (to change its opacity)
      map.setFeatureState(
        { source: 'peel_region_cycling_network', id: peel_bikeID },
        { hover: true } 
      );
    }
  });

  //specify events triggered by mouse leaving the 'peel_bikeways' layer
  map.on('mouseleave', 'peel_bikeways', () => { 
    //change the hover feature-state to "false" for the feature of the 'peel_bikeways' layer that was previously hovered over (to reset its original opacity) and re-initialize peel_bikeID to null
    if (peel_bikeID !== null) {
      map.setFeatureState(
        { source: 'peel_region_cycling_network', id: peel_bikeID },
        { hover: false }
      );
    }
    peel_bikeID = null;
  }); 

  //add a geojson file source "durham_region_cycling_network" for Durham Region bikeways
  map.addSource('durham_region_cycling_network', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/durham_region_cycling_network.geojson', 'generateId': true 
  });

  //add and style a layer of lines "durham_region_bikeways" from the defined "durham_region_cycling_network" source
  map.addLayer({
    'id': 'durham_region_bikeways',
    'type': 'line',
    'source': 'durham_region_cycling_network',
    'paint': {
      'line-width': 3,
      //specify the color of the lines based on the text contained within the "Classification" data field (i.e. based on the bikeway type)
      //note that 'downcase' is used to ignore the case of the entries in the field 'Classification' (some entries are uppercase so we make them lowercase)
      'line-color': [
        'case',
        ['==', 'bike lane', ['downcase', ['get', 'Classification']]],
        '#FC6468',
        ['==', 'cycle track', ['downcase', ['get', 'Classification']]],
        '#FFB900',
        ['==', 'multi-use trail', ['downcase', ['get', 'Classification']]],
        '#0072B2',
        ['==', 'sharrows', ['downcase', ['get', 'Classification']]],
        '#8B4DAB',
        ['==', 'hiking/park trail', ['downcase', ['get', 'Classification']]],
        '#009E73',
        ['==', 'paved shoulder', ['downcase', ['get', 'Classification']]],
        '#C11F73',
        'black'
      ],
       //modify the opacity of lines based on the hover feature-state (i.e. change opacity of lines when hovered over)
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, //change opacity of lines to 1 when hovered over
        0.5 //leave opacity of lines at 0.5 when not hovered over
      ]
    }
  });

  //change cursor to a pointer when mouse hovers over 'durham_region_bikeways' layer
  map.on('mouseenter', 'durham_region_bikeways', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'durham_region_bikeways' layer
  map.on('mouseleave', 'durham_region_bikeways', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'durham_region_bikeways' layer
  map.on('click', 'durham_region_bikeways', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Name:</b> "+ e.features[0].properties.Name + "<br>" + "<b>Classification:</b> " + e.features[0].properties.classification)
      .addTo(map);
  });
  
  let durham_bikeID = null; //assign initial value of 'durham_bikeID' variable as null

  //specify events triggered by moving mouse over the 'durham_region_bikeways' layer
  map.on('mousemove', 'durham_region_bikeways', (e) => {
    //enter conditional if mouse hovers over at least one feature of the 'durham_region_bikeways' layer
    if (e.features.length > 0) { 
      //if durham_bikeID IS NOT NULL - i.e. a feature was being hovered over immediately prior to another - set hover feature-state of this feature back to false to reset its original opacity (before continuing to move and highlight the next hovered line)
      if (durham_bikeID !== null) { 
        map.setFeatureState(
          { source: 'durham_region_cycling_network', id: durham_bikeID },
          { hover: false }
        );
      }
      //set 'durham_bikeID' variable to the id of the 'durham_region_bikeways' layer feature being hovered over
      durham_bikeID = e.features[0].id; 
      //change the hover feature-state to "true" for the feature of the 'durham_region_bikeways' layer being hovered over (to change its opacity)
      map.setFeatureState(
        { source: 'durham_region_cycling_network', id: durham_bikeID },
        { hover: true } 
      );
    }
  });

  //specify events triggered by mouse leaving the 'durham_region_bikeways' layer
  map.on('mouseleave', 'durham_region_bikeways', () => { 
    //change the hover feature-state to "false" for the feature of the 'durham_region_bikeways' layer that was previously hovered over (to reset its original opacity) and re-initialize durham_bikeID to null
    if (durham_bikeID !== null) {
      map.setFeatureState(
        { source: 'durham_region_cycling_network', id: durham_bikeID },
        { hover: false }
      );
    }
    durham_bikeID = null;
  }); 

  //add a geojson file source "burlington_cycling_networkk" for Burlington bikeways
  map.addSource('burlington_cycling_network', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/burlington_cycling_network.geojson', 'generateId': true 
  });

  //add and style a layer of lines "burlington_bikeways" from the defined "burlington_cycling_network" source
  map.addLayer({
    'id': 'burlington_bikeways',
    'type': 'line',
    'source': 'burlington_cycling_network',
    'paint': {
      'line-width': 3,
      //specify the color of the lines based on the text contained within the "Classification" data field (i.e. based on the bikeway type)
      //note that 'downcase' is used to ignore the case of the entries in the field 'Classification' (some entries are uppercase so we make them lowercase)
      'line-color': [
        'case',
        ['==', 'bike lane', ['downcase', ['get', 'Classification']]],
        '#FC6468',
        ['==', 'cycle track', ['downcase', ['get', 'Classification']]],
        '#FFB900',
        ['==', 'multi-use trail', ['downcase', ['get', 'Classification']]],
        '#0072B2',
        ['==', 'sharrows', ['downcase', ['get', 'Classification']]],
        '#8B4DAB',
        ['==', 'hiking/park trail', ['downcase', ['get', 'Classification']]],
        '#009E73',
        ['==', 'paved shoulder', ['downcase', ['get', 'Classification']]],
        '#C11F73',
        'black'
      ],
      //modify the opacity of lines based on the hover feature-state (i.e. change opacity of lines when hovered over)
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, //change opacity of lines to 1 when hovered over
        0.5 //leave opacity of lines at 0.5 when not hovered over
      ]
    }
  });

  //change cursor to a pointer when mouse hovers over 'burlington_bikeways' layer
  map.on('mouseenter', 'burlington_bikeways', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'burlington_bikeways' layer
  map.on('mouseleave', 'burlington_bikeways', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'burlington_bikeways' layer
  map.on('click', 'burlington_bikeways', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Street Name:</b> " + e.features[0].properties.street_name + "<br>" + "<b>Facility:</b> " + e.features[0].properties.type + "<br>" + "<b>Classification:</b> " + e.features[0].properties.Classification)
      .addTo(map);
  });

  let burlington_bikeID = null; //assign initial value of 'burlington_bikeID' variable as null

  //specify events triggered by moving mouse over the 'burlington_bikeways' layer
  map.on('mousemove', 'burlington_bikeways', (e) => {
    //enter conditional if mouse hovers over at least one feature of the 'burlington_bikeways' layer
    if (e.features.length > 0) { 
      //if burlington_bikeID IS NOT NULL - i.e. a feature was being hovered over immediately prior to another - set hover feature-state of this feature back to false to reset its original opacity (before continuing to move and highlight the next hovered line)
      if (burlington_bikeID !== null) { 
        map.setFeatureState(
          { source: 'burlington_cycling_network', id: burlington_bikeID },
          { hover: false }
        );
      }
      //set 'burlington_bikeID' variable to the id of the 'burlington_bikeways' layer feature being hovered over
      burlington_bikeID = e.features[0].id; 
      //change the hover feature-state to "true" for the feature of the 'burlington_bikeways' layer being hovered over (to change its opacity)
      map.setFeatureState(
        { source: 'burlington_cycling_network', id: burlington_bikeID },
        { hover: true } 
      );
    }
  });

  //specify events triggered by mouse leaving the 'burlington_bikeways' layer
  map.on('mouseleave', 'burlington_bikeways', () => { 
    //change the hover feature-state to "false" for the feature of the 'burlington_bikeways' layer that was previously hovered over (to reset its original opacity) and re-initialize burlington_bikeID to null
    if (burlington_bikeID !== null) {
      map.setFeatureState(
        { source: 'burlington_cycling_network', id: burlington_bikeID },
        { hover: false }
      );
    }
    burlington_bikeID = null;
  }); 

  //add a geojson file source "milton_cycling_network" for Milton bikeways
  map.addSource('milton_cycling_network', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/milton_cycling_network.geojson', 'generateId': true 
  });

  //add and style a layer of lines "milton_bikeways" from the defined "milton_cycling_network" source
  map.addLayer({
    'id': 'milton_bikeways',
    'type': 'line',
    'source': 'milton_cycling_network',
    'paint': {
      'line-width': 3,
      //specify the color of the lines based on the text contained within the "classification" data field (i.e. based on the bikeway type)
      //note that 'downcase' is used to ignore the case of the entries in the field 'classification' (some entries are uppercase so we make them lowercase)
      'line-color': [
        'case',
        ['==', 'bike lane', ['downcase', ['get', 'classification']]],
        '#FC6468',
        ['==', 'cycle track', ['downcase', ['get', 'classification']]],
        '#FFB900',
        ['==', 'multi-use trail', ['downcase', ['get', 'classification']]],
        '#0072B2',
        ['==', 'sharrows', ['downcase', ['get', 'classification']]],
        '#8B4DAB',
        ['==', 'hiking/park trail', ['downcase', ['get', 'classification']]],
        '#009E73',
        ['==', 'paved shoulder', ['downcase', ['get', 'classification']]],
        '#C11F73',
        'black'
      ],
       //modify the opacity of lines based on the hover feature-state (i.e. change opacity of lines when hovered over)
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, //change opacity of lines to 1 when hovered over
        0.5 //leave opacity of lines at 0.5 when not hovered over
      ]
    }
  });

  //change cursor to a pointer when mouse hovers over 'milton_bikeways' layer
  map.on('mouseenter', 'milton_bikeways', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'milton_bikeways' layer
  map.on('mouseleave', 'milton_bikeways', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'milton_bikeways' layer
  map.on('click', 'milton_bikeways', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Facility:</b> " +  e.features[0].properties.type + "<br>" + "<b>Classification:</b> " + e.features[0].properties.classification + "<br>" + "<b>Surface:</b> "  + e.features[0].properties.surface)
    .addTo(map);
  });

  let milton_bikeID = null; //assign initial value of 'milton_bikeID' variable as null

  //specify events triggered by moving mouse over the 'milton_bikeways' layer
  map.on('mousemove', 'milton_bikeways', (e) => {
    //enter conditional if mouse hovers over at least one feature of the 'milton_bikeways' layer
    if (e.features.length > 0) { 
      //if milton_bikeID IS NOT NULL - i.e. a feature was being hovered over immediately prior to another - set hover feature-state of this feature back to false to reset its original opacity (before continuing to move and highlight the next hovered line)
      if (milton_bikeID !== null) { 
        map.setFeatureState(
          { source: 'milton_cycling_network', id: milton_bikeID },
          { hover: false }
        );
      }
      //set 'milton_bikeID' variable to the id of the 'milton_bikeways' layer feature being hovered over
      milton_bikeID = e.features[0].id; 
      //change the hover feature-state to "true" for the feature of the 'milton_bikeways' layer being hovered over (to change its opacity)
      map.setFeatureState(
        { source: 'milton_cycling_network', id: milton_bikeID },
        { hover: true } 
      );
    }
  });

  //specify events triggered by mouse leaving the 'milton_bikeways' layer
  map.on('mouseleave', 'milton_bikeways', () => { 
    //change the hover feature-state to "false" for the feature of the 'milton_bikeways' layer that was previously hovered over (to reset its original opacity) and re-initialize milton_bikeID to null
    if (milton_bikeID !== null) {
      map.setFeatureState(
        { source: 'milton_cycling_network', id: milton_bikeID },
        { hover: false }
      );
    }
    milton_bikeID = null;
  }); 

  //add a geojson file source "oakville_cycling_network" for Oakville bikeways
  map.addSource('oakville_cycling_network', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/oakville_cycling_network.geojson' , 'generateId': true //https://ireo00.github.io/472-Resources/oakville_cycling_network.geojson'
  });

  //add and style a layer of lines "oakvill_bikeways" from the defined "oakville_cycling_network" source
  map.addLayer({
    'id': 'oakvill_bikeways',
    'type': 'line',
    'source': 'oakville_cycling_network',
    'paint': {
      'line-width': 3,
      //specify the color of the lines based on the text contained within the "Classification" data field (i.e. based on the bikeway type)
      //note that 'downcase' is used to ignore the case of the entries in the field 'Classification' (some entries are uppercase so we make them lowercase)
      'line-color': [
        'case',
        ['==', 'bike lane', ['downcase', ['get', 'Classification']]],
        '#FC6468',
        ['==', 'cycle track', ['downcase', ['get', 'Classification']]],
        '#FFB900',
        ['==', 'multi-use trail', ['downcase', ['get', 'Classification']]],
        '#0072B2',
        ['==', 'sharrows', ['downcase', ['get', 'Classification']]],
        '#8B4DAB',
        ['==', 'hiking/park trail', ['downcase', ['get', 'Classification']]],
        '#009E73',
        ['==', 'paved shoulder', ['downcase', ['get', 'Classification']]],
        '#C11F73',
        'black'
      ],
      //modify the opacity of lines based on the hover feature-state (i.e. change opacity of lines when hovered over)
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, //change opacity of lines to 1 when hovered over
        0.5 //leave opacity of lines at 0.5 when not hovered over
      ]
    }
  });

  //change cursor to a pointer when mouse hovers over 'oakvill_bikeways' layer
  map.on('mouseenter', 'oakvill_bikeways', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'oakvill_bikeways' layer
  map.on('mouseleave', 'oakvill_bikeways', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'oakvill_bikeways' layer
  map.on('click', 'oakvill_bikeways', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Facility:</b> " + e.features[0].properties.type + "<br>" + "<b>Classification:</b> "  + e.features[0].properties.Classification + "<br>" + "<b>Surface:</b> "  + e.features[0].properties.surface)
    .addTo(map);
  });

  let oakville_bikeID = null; //assign initial value of 'oakville_bikeID' variable as null

  //specify events triggered by moving mouse over the 'oakvill_bikeways' layer
  map.on('mousemove', 'oakvill_bikeways', (e) => {
    //enter conditional if mouse hovers over at least one feature of the 'oakvill_bikeways' layer
    if (e.features.length > 0) { 
      //if oakville_bikeID IS NOT NULL - i.e. a feature was being hovered over immediately prior to another - set hover feature-state of this feature back to false to reset its original opacity (before continuing to move and highlight the next hovered line)
      if (oakville_bikeID !== null) { 
        map.setFeatureState(
          { source: 'oakville_cycling_network', id: oakville_bikeID },
          { hover: false }
        );
      }
      //set 'oakville_bikeID' variable to the id of the 'oakvill_bikeways' layer feature being hovered over
      oakville_bikeID = e.features[0].id; 
      //change the hover feature-state to "true" for the feature of the 'oakvill_bikeways' layer being hovered over (to change its opacity)
      map.setFeatureState(
        { source: 'oakville_cycling_network', id: oakville_bikeID },
        { hover: true } 
      );
    }
  });

  //specify events triggered by mouse leaving the 'oakvill_bikeways' layer
  map.on('mouseleave', 'oakvill_bikeways', () => { 
    //change the hover feature-state to "false" for the feature of the 'oakvill_bikeways' layer that was previously hovered over (to reset its original opacity) and re-initialize oakville_bikeID to null
    if (oakville_bikeID !== null) {
      map.setFeatureState(
        { source: 'oakville_cycling_network', id: oakville_bikeID },
        { hover: false }
      );
    }
    oakville_bikeID = null;
  }); 

  //add a geojson file source "toronto_bicycle_parking" for Toronto bike parking stations
  map.addSource('toronto_bicycle_parking', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/toronto_bicycle_parking.geojson',
    'generateId': true,
    //cluster the data to limit the symbology on the map at low zoom levels
    cluster: true,
    clusterMaxZoom: 14, //maximum zoom at which points cluster
    clusterRadius: 50 //distance over which points cluster
  });

  //load and add image 'parking-marker' for parking icons (throw an error if this process fails)
  map.loadImage(
    'https://ireo00.github.io/472-Resources/bicycle-parking.png',
    (error, image) => {
      if (error) throw error;
      map.addImage('parking-marker', image);
    }
  );

  //add and style a layer of circles "toronto_bike_parking_clustered" from the defined "toronto_bicycle_parking" source for the clustered parking stations
  map.addLayer({
    'id': 'toronto_bike_parking_clustered',
    'type': 'circle',
    'source': 'toronto_bicycle_parking',
    //only show circles when there is more than 1 bike parking station within radius
    filter: ['has', 'point_count'],
    'paint': {
      'circle-color': '#84BCE4',
      //specify the radius of the circles based on whether the number of bike parking stations within radius is <10, 10-20, 20-50, 50-100 or >100
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        13,
        10,
        15,
        20,
        17,
        50,
        20,
        100,
        25
      ]
    }
  });

  //add and style a layer of symbols "toronto_bike_parking_cluster_count" from the defined "toronto_bicycle_parking" source for the text on top of the clustered parking stations
  map.addLayer({
    id: 'toronto_bike_parking_cluster_count',
    type: 'symbol',
    source: 'toronto_bicycle_parking',
    //only show text when there is more than 1 bike parking station within radius 
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
      //allow overlap of other text layers (so that all layers are simultaneously visible)
      'text-allow-overlap': true,
      'text-ignore-placement': true
    }
  });

  //add and style a layer of symbols "toronto_bike_parking_unclustered" from the defined "toronto_bicycle_parking" source for the unclustered (single) parking stations
  map.addLayer({
    id: 'toronto_bike_parking_unclustered',
    type: 'symbol',
    source: 'toronto_bicycle_parking',
    //only show symbols when there is 1 bike parking station within radius 
    filter: ['!', ['has', 'point_count']],
    layout: {
      //specify the image to be used as the symbols
      'icon-image': 'parking-marker',
      'icon-size': 0.15,
      //allow overlap of other icon layers (so that all layers are simultaneously visible)
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  });

  //change cursor to a pointer when mouse hovers over 'toronto_bike_parking_unclustered' layer
  map.on('mouseenter', 'toronto_bike_parking_unclustered', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'toronto_bike_parking_unclustered' layer
  map.on('mouseleave', 'toronto_bike_parking_unclustered', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'toronto_bike_parking_unclustered' layer
  map.on('click', 'toronto_bike_parking_unclustered', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Name:</b> " + e.features[0].properties.name + "<br>" + "<b>Address:</b> " + e.features[0].properties.address + "<br>" + "<b>Postal Code:</b> "
    + e.features[0].properties.postal_code + "<br>" + "<b>Ward:</b> " + e.features[0].properties.ward + "<br>" + "<b>City:</b>  " + e.features[0].properties.city + "<br>" + "<b>Parking Type:</b>  " + e.features[0].properties.parking_type + "<br>" +       
    "<b>Capacity:</b> " + e.features[0].properties.bike_capacity)
    .addTo(map);
  }); 
  
  //add a geojson file source "toronto_bicycle_shops" for Toronto bike shops
  map.addSource('toronto_bicycle_shops', {
    type: 'geojson',
    data: 'https://ireo00.github.io/472-Resources/toronto_bicycle_shops.geojson',
    'generateId': true,
    //cluster the data to limit the symbology on the map at low zoom levels
    cluster: true,
    clusterMaxZoom: 14, //maximum zoom at which points cluster
    clusterRadius: 50 //distance over which points cluster
  });

  //load and add image 'shop-marker' for shop icons (throw an error if this process fails)
  map.loadImage(
    'https://ireo00.github.io/472-Resources/bicycle-shop.png',
    (error, image) => {
      if (error) throw error;
      map.addImage('shop-marker', image);
    }
  );

  //add and style a layer of circles "toronto_bicycle_shops_clustered" from the defined "toronto_bicycle_shops" source for the clustered bike shops
  map.addLayer({
    'id': 'toronto_bicycle_shop_clustered',
    'type': 'circle',
    'source': 'toronto_bicycle_shops',
    //only show circles when there is more than 1 bike shop within radius
    filter: ['has', 'point_count'],
    'paint': {
      'circle-color': '#AC1C54',
      //specify the radius of the circles based on whether the number of bike shops within radius is <10, 10-20, 20-50, 50-100 or >100
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        13,
        10,
        15,
        20,
        17,
        50,
        20,
        100,
        25
      ]
    }
  });

  //add and style a layer of symbols "toronto_bicycle_shops_clustered_count" from the defined "toronto_bicycle_shops" source for the text on top of the clustered bike shops
  map.addLayer({
    id: 'toronto_bicycle_shop_clustered_count',
    type: 'symbol',
    source: 'toronto_bicycle_shops',
    //only show text when there is more than 1 bike shop within radius 
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
      //allow overlap of other text layers (so that all layers are simultaneously visible)
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': 'white'
    },
  });

  //add and style a layer of symbols "toronto_bicycle_shop_unclustered" from the defined "toronto_bicycle_shops" source for the unclustered (single) shops
  map.addLayer({
    id: 'toronto_bicycle_shop_unclustered',
    type: 'symbol',
    source: 'toronto_bicycle_shops',
    //only show symbols when there is 1 bike shop within radius 
    filter: ['!', ['has', 'point_count']],
    layout: {
      //specify the image to be used as the symbols
      'icon-image': 'shop-marker',
      'icon-size': 0.09,
      //allow overlap of other icon layers (so that all layers are simultaneously visible)
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  });

  //change cursor to a pointer when mouse hovers over 'toronto_bicycle_shop_unclustered' layer
  map.on('mouseenter', 'toronto_bicycle_shop_unclustered', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'toronto_bicycle_shop_unclustered' layer
  map.on('mouseleave', 'toronto_bicycle_shop_unclustered', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'toronto_bicycle_shop_unclustered' layer
  map.on('click', 'toronto_bicycle_shop_unclustered', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Name:</b> " + e.features[0].properties.name + "<br>" + "<b>Address:</b> " + e.features[0].properties.address + "<br>" + "<b>Postal Code:</b> "
    + e.features[0].properties.postal_code + "<br>" + "<b>Ward:</b> " + e.features[0].properties.ward + "<br>" +  "<b>Unit No:</b>  " + e.features[0].properties.unit + "<br>" + "<b>City:</b>  " + e.features[0].properties.city + "<br>" + "<b>Phone:</b>  " + e.features[0].properties.phone + "<br>" +       
    "<b>Email:</b> " + e.features[0].properties.email + "<br>" + "<b>Rentals?:</b> " + e.features[0].properties.rental)
    .addTo(map);
  });

  //add a geojson file source "ajax_cycling_network" for Ajax bikeways
  map.addSource('ajax_cycling_network', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/ajax_cycling_network.geojson',
    'generateId': true,
  });

  //add and style a layer of lines "ajax_bikeways" from the defined "ajax_cycling_network" source
  map.addLayer({
    'id': 'ajax_bikeways',
    'type': 'line',
    'source': 'ajax_cycling_network',
    'paint': {
      'line-width': 3,
      //specify the color of the lines based on the text contained within the "classification" data field (i.e. based on the bikeway type)
      //note that 'downcase' is used to ignore the case of the entries in the field 'classification' (some entries are uppercase so we make them lowercase)
      'line-color': [
        'case',
        ['==', 'bike lane', ['downcase', ['get', 'classification']]],
        '#FC6468',
        ['==', 'cycle track', ['downcase', ['get', 'classification']]],
        '#FFB900',
        ['==', 'multi-use trail', ['downcase', ['get', 'classification']]],
        '#0072B2',
        ['==', 'sharrows', ['downcase', ['get', 'classification']]],
        '#8B4DAB',
        ['==', 'hiking/park trail', ['downcase', ['get', 'classification']]],
        '#009E73',
        ['==', 'paved shoulder', ['downcase', ['get', 'classification']]],
        '#C11F73',
        'black'
      ],
      //modify the opacity of lines based on the hover feature-state (i.e. change opacity of lines when hovered over)
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, //change opacity of lines to 1 when hovered over
        0.5 //leave opacity of lines at 0.5 when not hovered over
      ]
    }
  });

  //change cursor to a pointer when mouse hovers over 'ajax_bikeways' layer
  map.on('mouseenter', 'ajax_bikeways', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'ajax_bikeways' layer
  map.on('mouseleave', 'ajax_bikeways', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'ajax_bikeways' layer
  map.on('click', 'ajax_bikeways', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Facility:</b> " + e.features[0].properties.type + "<br>" + "<b>Classification:</b> " + e.features[0].properties.classification + "<br>" + "<b>Street:</b> " + (e.features[0].properties.location).substring(0, (e.features[0].properties.location).length-9))
    .addTo(map);
  });

  let ajax_bikeID = null; //assign initial value of 'ajax_bikeID' variable as null

  //specify events triggered by moving mouse over the 'ajax_bikeways' layer
  map.on('mousemove', 'ajax_bikeways', (e) => {
    //enter conditional if mouse hovers over at least one feature of the 'ajax_bikeways' layer
    if (e.features.length > 0) { 
      //if ajax_bikeID IS NOT NULL - i.e. a feature was being hovered over immediately prior to another - set hover feature-state of this feature back to false to reset its original opacity (before continuing to move and highlight the next hovered line)
      if (ajax_bikeID !== null) { 
        map.setFeatureState(
          { source: 'ajax_cycling_network', id: ajax_bikeID },
          { hover: false }
        );
      }
      //set 'ajax_bikeID' variable to the id of the 'ajax_bikeways' layer feature being hovered over
      ajax_bikeID = e.features[0].id; 
      //change the hover feature-state to "true" for the feature of the 'ajax_bikeways' layer being hovered over (to change its opacity)
      map.setFeatureState(
        { source: 'ajax_cycling_network', id: ajax_bikeID },
        { hover: true } 
      );
    }
  });

  //specify events triggered by mouse leaving the 'ajax_bikeways' layer
  map.on('mouseleave', 'ajax_bikeways', () => { 
    //change the hover feature-state to "false" for the feature of the 'ajax_bikeways' layer that was previously hovered over (to reset its original opacity) and re-initialize ajax_bikeID to null
    if (ajax_bikeID !== null) {
      map.setFeatureState(
        { source: 'ajax_cycling_network', id: ajax_bikeID },
        { hover: false }
      );
    }
    ajax_bikeID = null;
  }); 

  //add a geojson file source "whitby_cycling_network" for Whitby bikeways
  map.addSource('whitby_cycling_network', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/whitby_cycling_network.geojson', 
    'generateId': true,
  });

  //add and style a layer of lines "whitby_bikeways" from the defined "whitby_cycling_network" source
  map.addLayer({
    'id': 'whitby_bikeways',
    'type': 'line',
    'source': 'whitby_cycling_network',
    'paint': {
      'line-width': 3,
      //specify the color of the lines based on the text contained within the "classification" data field (i.e. based on the bikeway type)
      //note that 'downcase' is used to ignore the case of the entries in the field 'classification' (some entries are uppercase so we make them lowercase)
      'line-color': [
        'case',
        ['==', 'bike lane', ['downcase', ['get', 'classification']]],
        '#FC6468',
        ['==', 'cycle track', ['downcase', ['get', 'classification']]],
        '#FFB900',
        ['==', 'multi-use trail', ['downcase', ['get', 'classification']]],
        '#0072B2',
        ['==', 'sharrows', ['downcase', ['get', 'classification']]],
        '#8B4DAB',
        ['==', 'hiking/park trail', ['downcase', ['get', 'classification']]],
        '#009E73',
        ['==', 'paved shoulder', ['downcase', ['get', 'classification']]],
        '#C11F73',
        'black'
      ],
      //modify the opacity of lines based on the hover feature-state (i.e. change opacity of lines when hovered over)
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, //change opacity of lines to 1 when hovered over
        0.5 //leave opacity of lines at 0.5 when not hovered over
      ]
    }
  });

  //change cursor to a pointer when mouse hovers over 'whitby_bikeways' layer
  map.on('mouseenter', 'whitby_bikeways', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'whitby_bikeways' layer
  map.on('mouseleave', 'whitby_bikeways', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'whitby_bikeways' layer
  map.on('click', 'whitby_bikeways', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Facility:</b> " + e.features[0].properties.type + "<br>" + "<b>Classification:</b> " + e.features[0].properties.classification + "<br>" + "<b>Street Name:</b> " + e.features[0].properties['road name'])
    .addTo(map);
  });

  let whitby_bikeID = null; //assign initial value of 'whitby_bikeID' variable as null

  //specify events triggered by moving mouse over the 'whitby_bikeways' layer
  map.on('mousemove', 'whitby_bikeways', (e) => {
    //enter conditional if mouse hovers over at least one feature of the 'whitby_bikeways' layer
    if (e.features.length > 0) { 
      //if whitby_bikeID IS NOT NULL - i.e. a feature was being hovered over immediately prior to another - set hover feature-state of this feature back to false to reset its original opacity (before continuing to move and highlight the next hovered line)
      if (whitby_bikeID !== null) { 
        map.setFeatureState(
          { source: 'whitby_cycling_network', id: whitby_bikeID },
          { hover: false }
        );
      }
      //set 'whitby_bikeID' variable to the id of the 'whitby_bikeways' layer feature being hovered over
      whitby_bikeID = e.features[0].id; 
      //change the hover feature-state to "true" for the feature of the 'whitby_bikeways' layer being hovered over (to change its opacity)
      map.setFeatureState(
        { source: 'whitby_cycling_network', id: whitby_bikeID },
        { hover: true } 
      );
    }
  });

  //specify events triggered by mouse leaving the 'whitby_bikeways' layer
  map.on('mouseleave', 'whitby_bikeways', () => { 
    //change the hover feature-state to "false" for the feature of the 'whitby_bikeways' layer that was previously hovered over (to reset its original opacity) and re-initialize whitby_bikeID to null
    if (whitby_bikeID !== null) {
      map.setFeatureState(
        { source: 'whitby_cycling_network', id: whitby_bikeID },
        { hover: false }
      );
    }
    whitby_bikeID = null;
  }); 

  //add a geojson file source "gta_bicycle_shops" for GTA (outside Toronto) bike shops
  map.addSource('gta_bicycle_shops', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/gta_bicycle_shops.geojson',
    'generateId': true,
    //cluster the data to limit the symbology on the map at low zoom levels
    cluster: true,
    clusterMaxZoom: 14, //maximum zoom at which points cluster
    clusterRadius: 50 //distance over which points cluster
  });

  //add and style a layer of circles "gta_bicycle_shop_clustered" from the defined "gta_bicycle_shops" source for the clustered bike shops
  map.addLayer({
    'id': 'gta_bicycle_shop_clustered',
    'type': 'circle',
    'source': 'gta_bicycle_shops',
    //only show circles when there is more than 1 bike shop within radius
    filter: ['has', 'point_count'],
    'paint': {
      'circle-color': '#AC1C54',
      //specify the radius of the circles based on whether the number of bike shops within radius is <10, 10-20, 20-50, 50-100 or >100
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        13,
        10,
        15,
        20,
        17,
        50,
        20,
        100,
        25
      ]
    }
  });

  //add and style a layer of symbols "gta_bicycle_shop_cluster_count" from the defined "gta_bicycle_shops" source for the text on top of the clustered bike shops
  map.addLayer({
    id: 'gta_bicycle_shop_cluster_count',
    type: 'symbol',
    source: 'gta_bicycle_shops',
    //only show text when there is more than 1 bike shop within radius 
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
      //allow overlap of other text layers (so that all layers are simultaneously visible)
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': 'white'
    },
  });

  //add and style a layer of symbols "gta_bicycle_shop_unclustered" from the defined "gta_bicycle_shops" source for the unclustered (single) shops
  map.addLayer({
    id: 'gta_bicycle_shop_unclustered',
    type: 'symbol',
    source: 'gta_bicycle_shops',
    //only show symbols when there is 1 bike shop within radius 
    filter: ['!', ['has', 'point_count']],
    layout: {
      //specify the image to be used as the symbols
      'icon-image': 'shop-marker',
      'icon-size': 0.08,
      //allow overlap of other icon layers (so that all layers are simultaneously visible)
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  });

  //change cursor to a pointer when mouse hovers over 'gta_bicycle_shop_unclustered' layer
  map.on('mouseenter', 'gta_bicycle_shop_unclustered', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'gta_bicycle_shop_unclustered' layer
  map.on('mouseleave', 'gta_bicycle_shop_unclustered', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'gta_bicycle_shop_unclustered' layer
  map.on('click', 'gta_bicycle_shop_unclustered', (e) => {
    //if the street number or street is not available, declare and add to map a popup at the longitude-latitude location of click which does not contain address
    if (e.features[0].properties.address_number=='Not Available' | e.features[0].properties.address_street=='Not Available'){
      new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML("<b>Name:</b> " + e.features[0].properties.name + "<br>" + "<b>Address:</b> " + "Not Available" + "<br>" + "<b>Postal Code:</b> "
      + e.features[0].properties.postal_code + "<br>" + "<b>Unit No:</b>  " + e.features[0].properties.unit + "<br>" + "<b>City:</b>  " + e.features[0].properties.city + "<br>" + "<b>Phone:</b>  " + e.features[0].properties.phone + "<br>" +       
      "<b>Email:</b> " + e.features[0].properties.email + "<br>" + "<b>Website:</b> " + e.features[0].properties.website + "<br>" + "<b>Facebook:</b> " + e.features[0].properties.facebook + "<br>" + "<b>Opening Hours:</b> " + e.features[0].properties.opening_hours)
      .addTo(map);
    }
    //if the street number and street are available, declare and add to map a popup at the longitude-latitude location of click which contains address
    else if (e.features[0].properties.address_number!='Not Available' && e.features[0].properties.address_street!='Not Available'){
      new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML("<b>Name:</b> " + e.features[0].properties.name + "<br>" + "<b>Address:</b> " + e.features[0].properties.address_number + " " + e.features[0].properties.address_street + "<br>" + "<b>Postal Code:</b> "
      + e.features[0].properties.postal_code + "<br>" + "<b>Unit No:</b>  " + e.features[0].properties.unit + "<br>" + "<b>City:</b>  " + e.features[0].properties.city + "<br>" + "<b>Phone:</b>  " + e.features[0].properties.phone + "<br>" +       
      "<b>Email:</b> " + e.features[0].properties.email + "<br>" + "<b>Website:</b> " + e.features[0].properties.website + "<br>" + "<b>Facebook:</b> " + e.features[0].properties.facebook + "<br>" + "<b>Opening Hours:</b> " + e.features[0].properties.opening_hours)
      .addTo(map);
    }
  });

   //add a geojson file source "gta_bicycle_parking" for GTA (outside Toronto) bike parking stations
  map.addSource('gta_bicycle_parking', {
    type: 'geojson',
    data: 'https://anamariiaz.github.io/GGR472-Group-Project-Sources/gta_bicycle_parking.geojson',
    'generateId': true,
    //cluster the data to limit the symbology on the map at low zoom levels
    cluster: true,
    clusterMaxZoom: 14, //maximum zoom at which points cluster
    clusterRadius: 50 //distance over which points cluster
  });

  //add and style a layer of circles "gta_bike_parking_clustered" from the defined "gta_bicycle_parking" source for the clustered parking stations
  map.addLayer({
    'id': 'gta_bike_parking_clustered',
    'type': 'circle',
    'source': 'gta_bicycle_parking',
    //only show circles when there is more than 1 bike parking station within radius
    filter: ['has', 'point_count'],
    'paint': {
      'circle-color': '#84BCE4',
      //specify the radius of the circles based on whether the number of bike parking stations within radius is <10, 10-20, 20-50, 50-100 or >100
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        13,
        10,
        15,
        20,
        17,
        50,
        20,
        100,
        25
      ]
    }
  });

  //add and style a layer of symbols "gta_bike_parking_cluster_count" from the defined "gta_bicycle_parking" source for the text on top of the clustered parking stations
  map.addLayer({
    id: 'gta_bike_parking_cluster_count',
    type: 'symbol',
    source: 'gta_bicycle_parking',
    //only show text when there is more than 1 bike parking station within radius 
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
      //allow overlap of other text layers (so that all layers are simultaneously visible)
      'text-allow-overlap': true,
      'text-ignore-placement': true
    }
  });

  //add and style a layer of symbols "toronto_bike_parking_unclustered" from the defined "gta_bicycle_parking" source for the unclustered (single) parking stations
  map.addLayer({
    id: 'gta_bike_parking_unclustered',
    type: 'symbol',
    source: 'gta_bicycle_parking',
    //only show symbols when there is 1 bike parking station within radius 
    filter: ['!', ['has', 'point_count']],
    layout: {
      //specify the image to be used as the symbols
      'icon-image': 'parking-marker',
      'icon-size': 0.13,
      //allow overlap of other icon layers (so that all layers are simultaneously visible)
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  });

  //change cursor to a pointer when mouse hovers over 'gta_bike_parking_unclustered' layer
  map.on('mouseenter', 'gta_bike_parking_unclustered', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  //change cursor back when mouse leaves 'gta_bike_parking_unclustered' layer
  map.on('mouseleave', 'gta_bike_parking_unclustered', () => {
    map.getCanvas().style.cursor = '';
  });

  //specify events triggered by clicking on the 'gta_bike_parking_unclustered' layer
  map.on('click', 'gta_bike_parking_unclustered', (e) => {
    //declare and add to map a popup at the longitude-latitude location of click
    new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML("<b>Name:</b> " + e.features[0].properties.name + "<br>" +  "<b>Covered?:</b> " + e.features[0].properties.covered + "<br>" + "<b>Fee:</b> " + e.features[0].properties.fee + "<br>" + "<b>Parking Type:</b> " + e.features[0].properties.parking_type + "<br>" +       
    "<b>Capacity:</b> " + e.features[0].properties.capacity)
    .addTo(map);
  });

  //add a vector file source "traffic_source" for traffic data from Mapbox traffic API
  map.addSource('traffic_source', {
    'type': 'vector',
    'url': 'mapbox://mapbox.mapbox-traffic-v1'
  });

  //add and style a layer of lines "traffic" from the defined "traffic_source" source for the traffic on the roads
  map.addLayer({
    'id': 'traffic',
    'type': 'line',
    'source': 'traffic_source',
    //declare initial visibility as 'none'
    'layout': { 'visibility': 'none' },
    'paint': {
      //specify the color of the lines based on the text contained within the "congestion" data field (i.e. based on the congestion level of traffic)
      'line-color': [
        "case",
        ["==", "low", ["get","congestion"]],
        "green",
        ["==", "moderate", ["get","congestion"]],
        "#ffff00",
        ["==", "heavy",["get","congestion"]],
        "orange",
        ["==","severe",["get","congestion"]],
        "red",
        "#000000"
      ],
      'line-width': 2
    },
    'source-layer': 'traffic'
  });

  //add a geojson file source "inputgeojson" for user-clicked points on the map through the planner tool
  map.addSource('inputgeojson', {
    type: 'geojson',
    data: geojson
  });

  //add and style a layer of circles "input-pnts" from the defined "inputgeojson" source for the user-clicked points on the map through the planner tool
  map.addLayer({
    'id': 'input-pnts',
    'type': 'circle',
    'source': 'inputgeojson',
    'paint': {
      'circle-radius': 5,
      'circle-color': 'blue'
    }
  });

  //add a geojson file source "buffgeojson" for the buffer generated around user-clicked points on the map through the planner tool
  map.addSource('buffgeojson', {
    "type": "geojson",
    "data": buffresult 
  });

  //add and style a layer of circles "inputpointbuff" from the defined "buffgeojson" source for the buffer generated around user-clicked points on the map through the planner tool
  map.addLayer({
    "id": "inputpointbuff",
    "type": "fill",
    "source": "buffgeojson",
    "paint": {
      'fill-color': "blue",
      'fill-opacity': 0.5,
      'fill-outline-color': "black"
    }
  });

});

//specify events triggered by clicking the 'Plan Your Trip!' button
document.getElementById('collapsible').addEventListener('click', () => {
  //assign 'content' variable to the the div containing the 'Plan Your Trip!' content
  var content = document.getElementById('content');
  //enter conditional if the 'Plan Your Trip!' content div was already open
  if (content.style.display === "block") {
    //close content div
    content.style.display = "none";
    //reinitialize 'geojson' FeatureCollection to be empty (i.e. erase any prior user-clicked point) and update the 'inputgeojson' source that uses 'geojson'
    geojson.features = []
    map.getSource('inputgeojson').setData(geojson);
    //reinitialize 'buffresult' FeatureCollection to be empty (i.e. erase any prior buffer) and update the 'buffgeojson' source that uses 'buffresult'
    buffresult.features = []
    map.getSource('buffgeojson').setData(buffresult);
    //clear any prior nearby features listed in the planner
    document.getElementById('nearby').innerHTML = ''
    //change the buffer button text back to 'GO' 
    document.getElementById('bufferbutton').textContent = "GO"
    //reinitialize longitude/latitude/property/type lists of nearby features to be empty (i.e. erase any information about prior nearby features)
    divs_lons = []
    divs_lats = []
    divs_properties = []
    divs_types = []
    //fly back to original view
    map.flyTo({
      center: [-79.266, 43.926],
      zoom: 8.65,
      bearing: -17.7,
      essential: true
    });
    //change the instructions in the planner back to the default
    const instructions = document.getElementById('instructions');
    instructions.innerHTML = 'Click anywhere on map';
    //change the slider value back to 0 and the slider value text back to '0km'
    document.getElementById('slider').value=0
    document.getElementById('radius_value').innerHTML=" " + "0km"
  }
  //enter conditional if the 'Plan Your Trip!' content div was closed
  else {
    //open content div 
    content.style.display = "block";
    //don't display the slider yet (not until user selects a point)
    slider_div = document.getElementById('slider_div');
    slider_div.style.display = 'none';
    //disable the buffer button (so that user can't click 'GO' without selecting a point first)
    document.getElementById("bufferbutton").disabled = true;
  }
});

let lastExecution = 0
//specify events triggered by clicking anywhere on the map
map.on('click', (e) => {
  //enter conditional if the 'Plan your Trip!' menu is open, no buffer has been created yet and a point has been clicked by a user a single time (a timeout is used to ensure no accidental double clicks occur)
  if (content.style.display === "block" && document.getElementById('bufferbutton').textContent === "GO" && ((lastExecution + 500) < Date.now())) {
    lastExecution = Date.now() //reinitialize date for timeout feature
    //assign 'clickedpoint' to a geojson-formatted feature of the user-clicked point on map
    const clickedpoint = {
      'type': 'Feature',
      'geometry': {
        'type': 'Point',
        'coordinates': [e.lngLat.lng, e.lngLat.lat]
      }
    };
    //reinitialize 'geojson' FeatureCollection to be empty (i.e. erase any prior user-clicked point) in case there was already another point in it
    geojson.features = []
    //add clicked point to empty 'geojson' FeatureCollection 
    geojson.features.push(clickedpoint);
    //update the instructions in the planner 
    const instructions = document.getElementById('instructions');
    instructions.innerHTML = 'Click GO';
    //update 'inputgeojson' source to include updated 'geojson' FeatureCollection which contains user-clicked point 
    map.getSource('inputgeojson').setData(geojson);
    //assign global variable 'lonlat_click' to the longitude-latitude of the user-clicked point
    lonlat_click = e.lngLat
    //un-disable buffer button so that user can click 'GO'
    document.getElementById("bufferbutton").disabled = false;
  }
});

//specify events triggered by clicking the 'GO/CLOSE' button in the 'Plan Your Trip!' menu
document.getElementById('bufferbutton').addEventListener('click', () => {
  //enter conditional if 'GO' is clicked and the length of 'geojson' FeatureCollection is >0 (i.e. if a point has been selected)
  if (document.getElementById('bufferbutton').textContent === "GO" && geojson.features.length > 0) {
    //change the buffer button text to 'CLOSE' 
    document.getElementById('bufferbutton').innerHTML = "CLOSE"
    //make all bikeshare, bike shop, bike parking layers visible (in case toggled off)
    map.setLayoutProperty('toronto_bikeshare_unclustered', 'visibility', 'visible')
    map.setLayoutProperty('toronto_bikeshare_clustered', 'visibility', 'visible')
    map.setLayoutProperty('toronto_bikeshare_cluster_count', 'visibility', 'visible')
    map.setLayoutProperty('toronto_bicycle_shop_unclustered', 'visibility', 'visible')
    map.setLayoutProperty('toronto_bicycle_shop_clustered', 'visibility', 'visible')
    map.setLayoutProperty('toronto_bicycle_shop_clustered_count', 'visibility', 'visible')
    map.setLayoutProperty('toronto_bike_parking_unclustered', 'visibility', 'visible')
    map.setLayoutProperty('toronto_bike_parking_clustered', 'visibility', 'visible')
    map.setLayoutProperty('toronto_bike_parking_cluster_count', 'visibility', 'visible')
    map.setLayoutProperty('gta_bike_parking_unclustered', 'visibility', 'visible')
    map.setLayoutProperty('gta_bike_parking_clustered', 'visibility', 'visible')
    map.setLayoutProperty('gta_bike_parking_cluster_count', 'visibility', 'visible')
    map.setLayoutProperty('gta_bicycle_shop_unclustered', 'visibility', 'visible')
    map.setLayoutProperty('gta_bicycle_shop_clustered', 'visibility', 'visible')
    map.setLayoutProperty('gta_bicycle_shop_cluster_count', 'visibility', 'visible')
    //check all the filter boxes of the above layers (in case toggled off)
    document.getElementById('layercheck2').checked = true
    document.getElementById('layercheck3').checked = true
    document.getElementById('layercheck1').checked = true
    //update the instructions in the planner 
    const instructions = document.getElementById('instructions');
    instructions.innerHTML = 'Select a buffer radius';
    //display slider
    slider_div = document.getElementById('slider_div');
    slider_div.style.display = 'block'
    //specify events triggered by changing the slider in the 'Plan Your Trip!' menu
    document.getElementById('slider').addEventListener('change', (e) => { 
      //update the slider text to specify the selected radius value in km
      document.getElementById('radius_value').innerHTML=" " + e.target.value +"km"
      //if isProcessing is set to true (i.e. if the code below has already run after selection of a new slider value), don't run it again (this is to avoid double input from the slider)
      if (isProcessing==true){
        return 
      }
      isProcessing=true
      //enter conditional is the selected slider value is not 0
      if (e.target.value!=0 ){ 
        //disable the buffer button, slider, and 'Plan Your Trip!' collapsible button (so that the user can't click any of them until the nearby features have fully loaded)
        document.getElementById("bufferbutton").disabled = true;
        document.getElementById('slider').disabled=true;
        document.getElementById('collapsible').disabled=true;
        //assign 'radius' variable to the user-selected radius
        const radius = e.target.value;
        //reinitialize 'buffresult' FeatureCollection to be empty (i.e. erase any prior buffer) in case there was already a buffer within it
        buffresult.features = []
        //clear any prior nearby features listed in the planner
        document.getElementById('nearby').innerHTML=''
        //reinitialize longitude/latitude/property/type lists of nearby features to be empty (i.e. erase any information about prior nearby features)
        divs_lons=[]
        divs_lats=[]
        divs_properties=[]
        divs_types=[]
        //create a buffer surrounding the user clicked point and store it in FeatureCollection 'buffresult'
        geojson.features.forEach((feature) => {
          let buffer = turf.buffer(feature, radius);
          buffresult.features.push(buffer);
        });
        //update 'buffgeojson' source to include updated 'buffresult' FeatureCollection which contains buffer around user-clicked point 
        map.getSource('buffgeojson').setData(buffresult);
        //update the instructions in the planner 
        const instructions = document.getElementById('instructions');
        instructions.innerHTML = 'Click on any features below to zoom in ';
        //call get_bikeshops function 
        get_bikeshops(divs_lons, divs_lats, divs_properties, divs_types)
      }
      //enter conditional is the selected slider value is 0
      else {
       //reinitialize 'buffresult' FeatureCollection to be empty (i.e. erase any prior buffer) and update the 'buffgeojson' source that uses 'buffresult'
        buffresult.features = []
        map.getSource('buffgeojson').setData(buffresult);
        //clear any prior nearby features listed in the planner
        document.getElementById('nearby').innerHTML = ''
        //reinitialize longitude/latitude/property/type lists of nearby features to be empty (i.e. erase any information about prior nearby features)
        divs_lons = []
        divs_lats = []
        divs_properties = []
        divs_types = []
        //update the instructions in the planner 
        const instructions = document.getElementById('instructions');
        instructions.innerHTML = 'Select a bigger radius';
        isProcessing = false
      }
    });
  }
  //enter conditional if 'CLOSE' is clicked (i.e. if a point and buffer have already been selected/created and user wishes to clear them)
  else {
    //remove the slider
    slider_div = document.getElementById('slider_div');
    slider_div.style.display = 'none'
    //change the slider value back to 0 and the slider value text back to '0km'
    document.getElementById('slider').value=0
    document.getElementById('radius_value').innerHTML=" " + "0km"
    //change the buffer button text back to 'GO' 
    document.getElementById('bufferbutton').innerHTML = "GO";
    //disable buffer button (so that user can't click 'GO' again until they select another point)
    document.getElementById("bufferbutton").disabled = true;
    //change the instructions in the planner back to the default
    instructions.innerHTML = 'Click anywhere on the map';
    //reinitialize 'geojson' FeatureCollection to be empty (i.e. erase any prior user-clicked point) and update the 'inputgeojson' source that uses 'geojson'
    geojson.features = []
    map.getSource('inputgeojson').setData(geojson);
    //reinitialize 'buffresult' FeatureCollection to be empty (i.e. erase any prior user-clicked point) and update the 'buffgeojson' source that uses 'buffresult'
    buffresult.features = []
    map.getSource('buffgeojson').setData(buffresult);
    //clear any prior nearby features listed in the planner
    document.getElementById('nearby').innerHTML = '';
    //reinitialize longitude/latitude/property/type lists of nearby features to be empty (i.e. erase any information about prior nearby features)
    divs_lons = []
    divs_lats = []
    divs_properties = []
    divs_types = []
    //fly back to original view
    map.flyTo({
      center: [-79.266, 43.926],
      zoom: 8.65,
      bearing: -17.7,
      essential: true
    });
  }
});

//create get_bikeshops function for finding all nearby bike shops and listing them in the planner 
function get_bikeshops(divs_lons, divs_lats, divs_properties, divs_types) {
  //retrieve external geojson file for all bike shops in GTA
  fetch('https://anamariiaz.github.io/GGR472-Group-Project-Sources/all_bicycle_shops.geojson')
  .then(response => response.json())
  .then(response => {
    shops = response; //assign variable "shops" to geojson file of all bike shops 
    //assign 'nearby' variable to the div for information about nearby amenities in the planner
    const nearby = document.getElementById('nearby');
    //assign 'text_div' variable to a created 'section'
    const text_div = document.createElement('div');
    //assign 'text' variable to a created 'span' (i.e. space into which content can be inserted)
    const text = document.createElement('span');
    //insert text into 'text' span
    text.innerHTML = 'Nearby Shops';
    text.style.color = '#AC1C54';
    text.style.fontWeight = 'bold';
    //if any bike shops exist within the buffer, add the 'text' span to the created section 'text_div'. and add the 'text_div' section to the planner (i.e. display 'Nearby Shops' in planner) 
    if (turf.pointsWithinPolygon(shops, buffresult.features[0]).features.length > 0) {
      text_div.appendChild(text)
      nearby.appendChild(text_div)
    }
    //loop through all bike shops that fall in the buffer
    turf.pointsWithinPolygon(shops, buffresult.features[0]).features.forEach((feature) => {
      //assign 'item' variable to a created 'section' with class 'divs' (which specifies its location and style in the css file)
      const item = document.createElement('div');
      item.className = 'divs'
      //add the longitude, latitude, properties, and type of the bike shop amenity to lists of nearby features
      divs_lons.push(feature.geometry.coordinates[0])
      divs_lats.push(feature.geometry.coordinates[1])
      divs_properties.push(feature.properties)
      divs_types.push("shop")
      //assign 'value' variable to a created 'span' (i.e. space into which content can be inserted)
      const value = document.createElement('span');
      //insert name of the bike shop into 'value' span, add 'value' span to the created section 'item', and add 'item' section into planner (i.e. display name of nearby amenity in planner)
      value.innerHTML = `${feature.properties.name}`;
      item.appendChild(value);
      nearby.appendChild(item);
    });
    //call get_bikeparking function only when all the above is done being run (since fetch is asynchronous)
    get_bikeparking(divs_lons, divs_lats, divs_properties, divs_types)
  });
}

//create get_bikeparking function for finding all nearby bike parkings and listing them in the planner 
function get_bikeparking(divs_lons, divs_lats, divs_properties, divs_types){
  //retrieve external geojson file for all bike parkings in GTA
  fetch('https://anamariiaz.github.io/GGR472-Group-Project-Sources/all_bicycle_parking.geojson') 
  .then(response => response.json())
  .then(response => {
    parkings = response; //assign variable "parkings" to geojson file of all bike parkings 
    //assign 'nearby_p' to the the div for information about nearby amenities in the planner
    const nearby_p = document.getElementById('nearby');
    //assign 'text_div_p' variable to a created 'section'
    const text_div_p = document.createElement('div');
    //assign 'text_p' variable to a created 'span' (i.e. space into which content can be inserted)
    const text_p = document.createElement('span');
    //insert text into 'text_p' span
    text_p.innerHTML = 'Nearby Parking'
    text_p.style.fontWeight = 'bold';
    text_p.style.color='#84BCE4'
    //if any bike parkings exist within the buffer, add the 'text_p' span to the created section 'text_div_p'. and add the 'text_div_p' section to the planner (i.e. display 'Nearby Parking' in planner) 
    if (turf.pointsWithinPolygon(parkings, buffresult.features[0]).features.length > 0) {
      text_div_p.appendChild(text_p)
      nearby_p.appendChild(text_div_p)
    }
    //loop through all bike parkings that fall in the buffer
    turf.pointsWithinPolygon(parkings, buffresult.features[0]).features.forEach((feature) => {
      //assign 'item_p' variable to a created 'section' with class 'divs' (which specifies its location and style in the css file)
      const item_p = document.createElement('div');
      item_p.className = 'divs'
      //add the longitude, latitude, properties, and type of the bike parking amenity to lists of nearby features
      divs_lons.push(feature.geometry.coordinates[0])
      divs_lats.push(feature.geometry.coordinates[1])
      divs_types.push("parking")
      divs_properties.push(feature.properties)
      //assign 'value_p' variable to a created 'span' (i.e. space into which content can be inserted)
      const value_p = document.createElement('span');
      //if the name is available, insert name of the bike parking into 'value_p' span
      if (feature.properties.name != 'None' && feature.properties.name != 'Not Available') {
        value_p.innerHTML = `${feature.properties.name}`;
      } 
      //if the name is not available, insert number of the bike parking into 'value_p' span
      else {
        value_p.innerHTML = `Bike Parking ${feature.properties.number}`; 
      }
      //add 'value_p' span to the created section 'item_p', and add 'item_p' section into planner (i.e. display name/number of nearby amenity in planner)
      item_p.appendChild(value_p);
      nearby_p.appendChild(item_p);
    });
    //call get_bikeways function only when all the above is done being run (since fetch is asynchronous)
    get_bikeways(divs_lons, divs_lats, divs_properties, divs_types)
  });
}

//create get_bikeways function for finding all nearby bikeways and listing them in the planner 
function get_bikeways(divs_lons, divs_lats, divs_properties, divs_types){
  //retrieve external geojson file for all bikeways in GTA
  fetch('https://anamariiaz.github.io/GGR472-Group-Project-Sources/all_bikeways.geojson') 
  .then(response => response.json())
  .then(response => {
    bikeways = response; //assign variable "bikeways" to geojson file of all bikeways 
    //assign 'nearby_b' variable to the div for information about nearby amenities in the planner
    const nearby_b = document.getElementById('nearby');
    //assign 'text_div_b' variable to a created 'section'
    const text_div_b = document.createElement('div');
    //assign 'text_b' variable to a created 'span' (i.e. space into which content can be inserted)
    const text_b = document.createElement('span');
    //insert text into 'text_b' span
    text_b.innerHTML = 'Nearby Bikeways'
    text_b.style.fontWeight = 'bold';
    text_b.style.color = '#767676'
    //loop through all bikeways
    bikeways.features.forEach((feature) => {
      //if any bikeways intersect the buffer, add the 'text_b' span to the created section 'text_div_b'. and add the 'text_div_b' section to the planner (i.e. display 'Nearby Bikeways' in planner) 
      if (feature.geometry.coordinates[0].length>0 && turf.booleanIntersects(feature, buffresult.features[0])===true) {
        text_div_b.appendChild(text_b)
        nearby_b.appendChild(text_div_b)
        return
      }
    });
    //loop through all bikeways
    bikeways.features.forEach((feature) => {
      //enter conditional if a bikeway intersects the buffer
      if (feature.geometry.coordinates[0].length>0 && turf.booleanIntersects(feature, buffresult.features[0])){
        //assign 'item_b' variable to a created 'section' with class 'divs' (which specifies its location and style in the css file)
        const item_b = document.createElement('div');
        item_b.className = 'divs'
        //add the longitude (of the starting point), latitude (of the starting point), properties, and type of the bikeway amenity to lists of nearby features
        divs_lons.push(feature.geometry.coordinates[0][0][0])
        divs_lats.push(feature.geometry.coordinates[0][0][1])
        divs_types.push("bikeway")
        divs_properties.push(feature.properties)
        //assign 'value_b' variable to a created 'span' (i.e. space into which content can be inserted)
        const value_b = document.createElement('span');
        //if the name is available, insert name of the bikeway into 'value_b' span
        if (feature.properties.Name!=null && feature.properties.Name != 'None' && feature.properties.Name != 'Not Available') {
          value_b.innerHTML = `${feature.properties.Name}`;
        } 
        //if the name is not available, insert number of the bikeway into 'value_b' span
        else {
          value_b.innerHTML = `Bikeway ${feature.properties.number}`; 
        }
        //add 'value_b' span to the created section 'item_b', and add 'item_b' section into planner (i.e. display name/number of nearby amenity in planner)
        item_b.appendChild(value_b);
        nearby_b.appendChild(item_b);
      }
    });
    //call get_bikeshare function only when all the above is done being run (since fetch is asynchronous)
    get_bikeshare(divs_lons, divs_lats, divs_properties, divs_types)
  });
}

//create get_bikeshare function for finding all nearby bikeshares and listing them in the planner 
function get_bikeshare(divs_lons, divs_lats, divs_properties, divs_types) {
  //assign variable "shares" to geojson file of all bikeshare stations (using feature list 'test' defined on map load)
  shares = {
    "type": "FeatureCollection",
    "features": test 
  }; 
  //assign 'nearby_s' to the div for information about nearby amenities in the planner
  const nearby_s = document.getElementById('nearby');
  //assign 'text_div_s' variable to a created 'section'
  const text_div_s = document.createElement('div');
  //assign 'text_s' variable to a created 'span' (i.e. space into which content can be inserted)
  const text_s = document.createElement('span');
  //insert text into 'text_s' span
  text_s.innerHTML = 'Nearby BikeShare'
  text_s.style.fontWeight = 'bold';
  text_s.style.color ='#147453'
  //if any bikeshares exist within the buffer, add the 'text_s' span to the created section 'text_div_s'. and add the 'text_div_s' section to the planner (i.e. display 'Nearby BikeShare' in planner) 
  if (turf.pointsWithinPolygon(shares, buffresult.features[0]).features.length > 0) {
    text_div_s.appendChild(text_s)
    nearby_s.appendChild(text_div_s)
  }
  //loop through all bikeshares that fall in the buffer
  turf.pointsWithinPolygon(shares, buffresult.features[0]).features.forEach((feature) => {
    //assign 'item_s' variable to a created 'section' with class 'divs' (which specifies its location and style in the css file)
    const item_s = document.createElement('div');
    item_s.className = 'divs'
    //add the longitude, latitude, properties, and type of the bikeshare amenity to lists of nearby features
    divs_lons.push(feature.geometry.coordinates[0])
    divs_lats.push(feature.geometry.coordinates[1])
    divs_types.push("share")
    divs_properties.push(feature.properties)
    //assign 'value_s' variable to a created 'span' (i.e. space into which content can be inserted)
    const value_s = document.createElement('span');
    //if the name is available, insert name of the bikeshare into 'value_s' span
    if (feature.properties.name != 'None') {
      value_s.innerHTML = `${feature.properties.name}`;
    } 
    //if the name is not available, insert station id of the bikeshare into 'value_s' span
    else {
      value_s.innerHTML = `BikeShare ${feature.properties.station_id}`;
    }
    //add 'value_s' span to the created section 'item_s', and add 'item_s' section into planner (i.e. display name/id of nearby amenity in planner)
    item_s.appendChild(value_s);
    nearby_s.appendChild(item_s);
  });
  //call get_weather function 
  get_weather(divs_lons, divs_lats, divs_properties, divs_types)
}

//create get_weather function for finding weather conditions at clicked point and listing them in the planner
function get_weather(divs_lons, divs_lats, divs_properties, divs_types) {
  //assign 'lon_point' and 'lat_point' variables to longitude and latitude of clicked point
  let lon_point = lonlat_click['lng']
  let lat_point = lonlat_click['lat']
  //assign 'today_point' variable to current date 
  var today_point = new Date()
  //assign 'month_point' and 'day_point' variables to current month and date (formatted)
  if ((today_point.getMonth()+1)<10) {
    month_point='0'+(today_point.getMonth()+1)
  }
  else {
    month_point=today_point.getMonth()+1
  }
  if (today_point.getDate()<10) {
    day_point='0'+(today_point.getDate())
  }
  else {
    day_point=today_point.getDate()
  }
  //assign 'date_point' variable to current date, formatted in YYYY-MM-DD
  var date_point = today_point.getFullYear() +'-'+month_point+'-'+day_point 
  //assign 'hour_point' variable to current hour
  var hour_point = today_point.getHours()
  //assign 'nearby_w' variable to the div for information about nearby amenities/weather in the planner
  const nearby_w = document.getElementById('nearby');
  //assign 'text_div_w' variable to a created 'section'
  const text_div_w = document.createElement('div');
  //assign 'text_w' variable to a created 'span' (i.e. space into which content can be inserted)
  const text_w = document.createElement('span');
  //insert text into 'text_w' span
  text_w.innerHTML = 'Weather'
  text_w.style.fontWeight = 'bold';
  //add the 'text_w' span to the created section 'text_div_w'. and add the 'text_div_w' section to the planner (i.e. display 'Weather' in planner) 
  text_div_w.appendChild(text_w)
  nearby_w.appendChild(text_div_w)
  //retrieve external JSON file of temperature at 2m above clicked point during current day from Open-Meteo API
  fetch(`https://api.open-meteo.com/v1/ecmwf?latitude=${lat_point}&longitude=${lon_point}&hourly=temperature_2m&start_date=${date_point}&end_date=${date_point}`)
  .then(response => response.json())
  .then(response => {
    temp_at_point = response; //assign variable "temp_at_point" to JSON file of temperature at clicked point during current day
    //assign 'item_temp' variable to a created 'section'
    const item_temp = document.createElement('div');
    //assign 'value_temp' variable to a created 'span' (i.e. space into which content can be inserted)
    const value_temp = document.createElement('span');
    //insert most recent forecasted temperature into 'value_temp' span (API JSON file contains forecasted temperature at every 3 hours for given day)
    value_temp.innerHTML = temp_at_point.hourly.temperature_2m[Math.floor(hour_point / 3)] + '°C' 
    //add 'value_temp' span to the created section 'item_temp', and add 'item_temp' section into planner (i.e. display temperature in planner)
    item_temp.appendChild(value_temp);
    nearby_w.appendChild(item_temp);
    //call precip function only when all the above is done being run (since fetch is asynchronous) 
    precip()
  });
  //create precip function for finding total precipitation sum at clicked point and listing it in the planner
  function precip(){
    //retrieve external JSON file of total precipitation sum at clicked point during current day from Open-Meteo API
    fetch(`https://api.open-meteo.com/v1/ecmwf?latitude=${lat_point}&longitude=${lon_point}&hourly=precipitation&start_date=${date_point}&end_date=${date_point}`)
    .then(response => response.json())
    .then(response => {
      prec_at_point = response; //assign variable "precip_at_point" to JSON file of total precipitation sum at clicked point during current day
      //assign 'nearby_w' variable to the div for information about nearby amenities/weather in the planner
      const nearby_w = document.getElementById('nearby');
      //assign 'item_prec' variable to a created 'section'
      const item_prec = document.createElement('div');
      //assign 'value_prec' variable to a created 'span' (i.e. space into which content can be inserted)
      const value_prec = document.createElement('span');
      //insert most recent forecasted total precipitation into 'value_prec' span (API JSON file contains forecasted total precipitation at every 3 hours for given day)
      value_prec.innerHTML = prec_at_point.hourly.precipitation[Math.floor(hour_point / 3)] + 'mm total precipitation in last hour' 
      //add 'value_prec' span to the created section 'item_prec', and add 'item_prec' section into planner (i.e. display total precipitation in planner)
      item_prec.appendChild(value_prec);
      nearby_w.appendChild(item_prec);
      //call snow function only when all the above is done being run (since fetch is asynchronous)
      snow()
    });
  }
  //create snow function for finding total snow sum above clicked point and listing it in the planner
  function snow(){
    //retrieve external JSON file of total snow sum above clicked point during current day from Open-Meteo API
    fetch(`https://api.open-meteo.com/v1/ecmwf?latitude=${lat_point}&longitude=${lon_point}&hourly=snowfall&start_date=${date_point}&end_date=${date_point}`)
    .then(response => response.json())
    .then(response => {
      snow_at_point = response; //assign variable "snow_at_point" to JSON file of snow at clicked point during current day
      //assign 'nearby_w' variable to the div for information about nearby amenities/weather in the planner
      const nearby_w = document.getElementById('nearby');
      //assign 'item_snow' variable to a created 'section'
      const item_snow = document.createElement('div');
      //assign 'value_snow' variable to a created 'span' (i.e. space into which content can be inserted)
      const value_snow = document.createElement('span');
      //insert most recent forecasted snow into 'value_snow' span (API JSON file contains forecasted snow at every 3 hours for given day)
      value_snow.innerHTML = snow_at_point.hourly.snowfall[Math.floor(hour_point / 3)] + 'mm snowfall in last hour' 
      //add 'value_prec' span to the created section 'item_snow', and add 'item_snow' section into planner (i.e. display snow in planner)
      item_snow.appendChild(value_snow);
      nearby_w.appendChild(item_snow);
      //call wind function only when all the above is done being run (since fetch is asynchronous)
      wind()
    });
  }
  //create wind function for finding wind speed at 10m above clicked point and listing it in the planner
  function wind(){
    //retrieve external JSON file of wind speed at 10m above clicked point during current day from Open-Meteo API
    fetch(`https://api.open-meteo.com/v1/ecmwf?latitude=${lat_point}&longitude=${lon_point}&hourly=windspeed_10m&start_date=${date_point}&end_date=${date_point}`)
    .then(response => response.json())
    .then(response => {
      wind_at_point = response; //assign variable "wind_at_point" to JSON file of wind speed at 10m above clicked point during current day
      //assign 'nearby_w' variable to the div for information about nearby amenities/weather in the planner
      const nearby_w = document.getElementById('nearby');
      //assign 'item_wind' variable to a created 'section'
      const item_wind = document.createElement('div');
      //assign 'value_wind' variable to a created 'span' (i.e. space into which content can be inserted)
      const value_wind = document.createElement('span');
      //insert most recent forecasted wind speed into 'value_wind' span (API JSON file contains forecasted wind speed at every 3 hours for given day)
      value_wind.innerHTML = wind_at_point.hourly.windspeed_10m[Math.floor(hour_point / 3)] + 'km/h wind at 10m above ground' 
      //add 'value_wind' span to the created section 'item_wind', and add 'item_wind' section into planner (i.e. display wind speed in planner)
      item_wind.appendChild(value_wind);
      nearby_w.appendChild(item_wind);
      //call list_click function only when all the above is done being run (since fetch is asynchronous)
      list_click(divs_lons, divs_lats, divs_properties, divs_types)
    });
  }
}

//create list_click function for finding allowing user to click on nearby amenities in the planner
function list_click(divs_lons, divs_lats, divs_properties, divs_types) {
  isProcessing = false
  //un-disable the buffer button, slider, and 'Plan Your Trip!' collapsible button (now that the nearby features have fully loaded) to allow user to 'CLOSE' planner
  document.getElementById("bufferbutton").disabled = false;
  document.getElementById('slider').disabled=false;
  document.getElementById('collapsible').disabled=false;
  //retrieve all nearby amenities stored in class 'divs'
  var elements = document.getElementsByClassName("divs");
  //enter conditional if there exists nearby amenities
  if (elements.length > 0) {
    //loop through all nearby amenities
    for (var i = 0; i < elements.length; i++) {
      //assign 'lat1', 'lon1', 'properties1', 'features1' variables to longitude, latitudes, property and type of nearby amenity
      let lat1 = divs_lats[i]
      let lon1 = divs_lons[i]
      let properties1 = divs_properties[i]
      let features1 = divs_types[i]

      lastExecution3 = 0
      //specify events triggered by clicking on any nearby amenities in planner
      elements[i].addEventListener('click', () => {
        //(a timeout is used to ensure no accidental double clicks occur)
        if ((lastExecution3+600)<Date.now()){
          lastExecution3=Date.now() //reinitialize date for timeout feature
          //fly to location of clicked amenity
          map.flyTo({
            center: [lon1, lat1],
            zoom: 16,
            bearing: -17.7,
            essential: true
          });
          //enter conditional if the clicked nearby amenity is a shop
          if (features1==="shop"){
            //if the clicked nearby shop is in Toronto, declare and add to map a popup at the longitude-latitude location of shop with information available for Toronto shops
            if (properties1.city==='Toronto'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Name:</b> " + properties1.name + "<br>" + "<b>Address:</b> " + properties1.address + "<br>" + "<b>Postal Code:</b> "
              + properties1.postal_code + "<br>" + "<b>Ward:</b> " + properties1.ward + "<br>" +  "<b>Unit No:</b>  " + properties1.unit + "<br>" + "<b>City:</b>  " + properties1.city + "<br>" + "<b>Phone:</b>  " + properties1.phone + "<br>" +       
              "<b>Email:</b> " + properties1.email + "<br>" + "<b>Rentals?:</b> " + properties1.rental)
              .addTo(map);
            }
            //if the clicked nearby shop is not in Toronto and the address street or number is not available, declare and add to map a popup at the longitude-latitude location of shop with information available for GTA (outside Toronto) shops (that does not include address)
            else if (properties1.city!='Toronto' && (properties1.address_number=='Not Available' | properties1.address_street=='Not Available')){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Name:</b> " + properties1.name + "<br>" + "<b>Address:</b> " + "Not Available" + "<br>" + "<b>Postal Code:</b> "
              + properties1.postal_code + "<br>" + "<b>Unit No:</b>  " + properties1.unit + "<br>" + "<b>City:</b>  " + properties1.city + "<br>" + "<b>Phone:</b>  " + properties1.phone + "<br>" +       
              "<b>Email:</b> " + properties1.email + "<br>" + "<b>Website:</b> " + properties1.website + "<br>" + "<b>Facebook:</b> " + properties1.facebook + "<br>" + "<b>Opening Hours:</b> " + properties1.opening_hours)
              .addTo(map);
            }
            //if the clicked nearby shop is not in Toronto and the address street and number are available, declare and add to map a popup at the longitude-latitude location of shop with information available for GTA (outside Toronto) shops (that includes address)
            else if (properties1.city!='Toronto' && properties1.address_number!='Not Available' && properties1.address_street!='Not Available'){
              new mapboxgl.Popup()
                .setLngLat([lon1, lat1])
                .setHTML("<b>Name:</b> " + properties1.name + "<br>" + "<b>Address:</b> " + properties1.address_number + " " + properties1.address_street + "<br>" + "<b>Postal Code:</b> "
                + properties1.postal_code + "<br>" + "<b>Unit No:</b>  " + properties1.unit + "<br>" + "<b>City:</b>  " + properties1.city + "<br>" + "<b>Phone:</b>  " + properties1.phone + "<br>" +       
                "<b>Email:</b> " + properties1.email + "<br>" + "<b>Website:</b> " + properties1.website + "<br>" + "<b>Facebook:</b> " + properties1.facebook + "<br>" + "<b>Opening Hours:</b> " + properties1.opening_hours)
                .addTo(map);
            }   
          }
          //enter conditional if the clicked nearby amenity is a parking
          else if (features1==="parking"){
            //if the clicked nearby parking is in Toronto, declare and add to map a popup at the longitude-latitude location of parking with information available for Toronto parkings
            if (properties1.city==='Toronto'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Name:</b> " + properties1.name + "<br>" + "<b>Address:</b> " + properties1.address + "<br>" + "<b>Postal Code:</b> "
              + properties1.postal_code + "<br>" + "<b>Ward:</b> " + properties1.ward + "<br>" + "<b>City:</b>  " + properties1.city + "<br>" + "<b>Parking Type:</b>  " + properties1.parking_type + "<br>" +       
              "<b>Capacity:</b> " + properties1.bike_capacity)
              .addTo(map);
            }
            //if the clicked nearby parking is not in Toronto, declare and add to map a popup at the longitude-latitude location of parking with information available for GTA (outside Toronto) parkings
            else if (properties1.city!='Toronto'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Name:</b> " + properties1.name + "<br>" +  "<b>Covered?:</b> " + properties1.covered + "<br>" + "<b>Fee:</b> " + properties1.fee + "<br>" + "<b>Parking Type:</b> " + properties1.parking_type + "<br>" +       
              "<b>Capacity:</b> " + properties1.capacity) 
              .addTo(map);
            }
          }
          //enter conditional if the clicked nearby amenity is a share
          else if (features1==="share"){
            //assign 'station_id', 'name', 'address', 'post_code' variables to the station id, name, address, and postal code properties of the clicked bike share
            let station_id=properties1.station_id
            let name=properties1.name
            let address=properties1.address
            let post_code=properties1.post_code
            //retrieve external JSON file for BikeShare station status information from Toronto BikeShare API
            fetch('https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_status')
            .then(response => response.json())
            .then(response => {
              bikeshare_status = response;  ///assign variable "bikeshare_status" to BikeShare station status information JSON file from Toronto BikeShare API
              //loop through all of the BikeShare stations in the BikeShare station status information JSON file
              bikeshare_status.data.stations.forEach((station) => {
                //enter conditional if the id of the BikeShare station in the BikeShare station status information JSON file matches the id of the clicked bikeshare station
                if (station.station_id===station_id){
                  //if the postal code is not undefined, declare and add to map a popup at the longitude-latitude location of click which contains the postal code
                  if (post_code!="undefined"){
                    new mapboxgl.Popup()
                    .setLngLat([lon1, lat1])
                    .setHTML("<b>Name:</b> " + name + "<br>" + "<b>Address:</b> " + address + "<br>" + "<b>Postal Code:</b> " + post_code + "<br>" + "<b>No. Available Bikes:</b> " + station.num_bikes_available + "<br>" + "<b>No. Available Docks:</b> " + station.num_docks_available)
                    .addTo(map);
                  }
                  //if the postal code is undefined, declare and add to map a popup at the longitude-latitude location of click which does not contain the postal code
                  else if (post_code=="undefined") {
                    new mapboxgl.Popup()
                    .setLngLat([lon1, lat1])
                    .setHTML("<b>Name:</b> " + name + "<br>" + "<b>Address:</b> " + address + "<br>" + "<b>No. Available Bikes:</b> " + station.num_bikes_available + "<br>" + "<b>No. Available Docks:</b> " + station.num_docks_available)
                    .addTo(map);
                  }
                }
              });
            });     
          }
          //enter conditional if the clicked nearby amenity is a bikeway
          else if (features1==="bikeway"){
            //declare and add to map a popup at the longitude-latitude start location of bikeway with information available for the GTA area it is located in
            if (properties1.region==='Whitby'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Facility:</b> " + properties1.type + "<br>" + "<b>Classification:</b> " + properties1.classification + "<br>" + "<b>Street Name:</b> " + properties1['road name'])
              .addTo(map);
            }
            else if (properties1.region==='Ajax'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Facility:</b> " + properties1.type + "<br>" + "<b>Classification:</b> " + properties1.classification + "<br>" + "<b>Street:</b> " + (properties1.location).substring(0, (properties1.location).length-9))
              .addTo(map);
            }
            else if (properties1.region==='Oakville'){
              new mapboxgl.Popup()
            .setLngLat([lon1, lat1])
            .setHTML("<b>Facility:</b> " + properties1.type + "<br>" + "<b>Classification:</b> "  + properties1.classification + "<br>" + "<b>Surface:</b> "  + properties1.surface)
            .addTo(map);
            }
            else if (properties1.region==='Milton'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Facility:</b> " +  properties1.type + "<br>" + "<b>Classification:</b> " + properties1.classification + "<br>" + "<b>Surface:</b> "  + properties1.surface)
              .addTo(map);
            }
            else if (properties1.region==='Burlington'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Street Name:</b> " + properties1.street_name + "<br>" + "<b>Facility:</b> " + properties1.type + "<br>" + "<b>Classification:</b> " + properties1.classification)
              .addTo(map);
            }
            else if (properties1.region==='Durham'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Name:</b> "+ properties1.Name + "<br>" + "<b>Classification:</b> " + properties1.classification)
              .addTo(map);
            }
            else if (properties1.region==='Peel'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Name:</b> " + properties1.Name + "<br>" + "<b>Facility:</b> " + properties1.type + "<br>" + "<b>Classification:</b> " +  properties1.classification +
              "<br>" + "<b>Surface:</b> " + properties1.surface + "<br>" + "<b>Municipality:</b> " +  properties1.Municipality) //if statement needed
              .addTo(map);
            }
            else if (properties1.region==='York'){
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Name:</b> " + properties1.Name + "<br>" + "<b>Facility:</b> " + properties1.type + "<br>" + "<b>Classification:</b> " + properties1.classification +
              "<br>" + "<b>Surface:</b> " + properties1.surface + "<br>" + "<b>Municipality:</b> " +  properties1.Municipality ) //if statement needed for "systems"
              .addTo(map);
            }
            else if (properties1.region==='Toronto'){         
              new mapboxgl.Popup()
              .setLngLat([lon1, lat1])
              .setHTML("<b>Name:</b> " + properties1.Name + "<br>" + "<b>Facility 1:</b> " + properties1.type +  "<br>" + "<b>Classification:</b> " + properties1.classification
              + "<br>" + "<b>Facility 2:</b> " + properties1.secondary_type) //if statement
              .addTo(map);
            }       
          }     
        }
      });
    };
  };
}

//create weather_api function for extracting latitude and longitude coordinates of all GTA municipality centroids (at which weather will be computed)
function weather_api(variable) {
  //initialize variables to empty lists
  let random_list = []
  let temperature_list = []
  let index_list = []
  //retrieve geojson file for centroids of all GTA municipalities
  fetch('https://ireo00.github.io/472-Resources/all_centroids.geojson')
  .then(response => response.json())
  .then(response => {
    all_centroids = response; //assign variable "all_centroids" to centroids geojson file 
    //loop through all centroids of GTA municipalities
    for (i = 0; i < all_centroids.features.length; i++) {
      //assign 'lon' and 'lat' variables to longitude and latitude of the centroids
      var lat = all_centroids.features[i].geometry.coordinates[1];
      var lon = all_centroids.features[i].geometry.coordinates[0];
      //assign 'today' to current date 
      var today = new Date()
      //assign 'month' and 'day' variables to current month and date (formatted)
      if ((today.getMonth()+1)<10) {
        month='0'+(today.getMonth()+1)
      }
      else {
        month=today.getMonth()+1
      }
      if (today.getDate()<10) {
        day='0'+(today.getDate())
      }
      else {
        day=today.getDate()
      }
      //assign 'date' variable to current date, formatted in YYYY-MM-DD
      var date = today.getFullYear() +'-'+month+'-'+day 
      //assign 'hour' variable to current hour
      var hour = today.getHours()
      //call weat function for each centroid being looped through - only when all the above is done being run (since fetch is asynchronous)
      weat(i, lat, lon, date, hour, random_list, temperature_list, index_list, variable)
    };
  });
}

//create weather_api function for finding weather conditions (selected from the weather dropdown menu) at GTA municipality centroids 
function weat(i, lat, lon, date, hour, random_list, temperature_list, index_list, variable) {
  //retrieve external JSON file of user-selected weather condition from dropdown menu (temperature, total precipitation, snow, wind speed) at centroid being looped through during current day from Open-Meteo API
  fetch(`https://api.open-meteo.com/v1/ecmwf?latitude=${lat}&longitude=${lon}&hourly=${variable}&start_date=${date}&end_date=${date}`)
  .then(response => response.json())
  .then(response => {
    weather = response; //assign variable "weather" to JSON file of selected weather condition at centroid being looped through during current day
    //call polygon1 function only when all the above is done being run (since fetch is asynchronous)
    polygon1(i, lat, lon, date, hour, weather, random_list, temperature_list, index_list, variable)
  });
}

//create polygon1 function for matching up centroids to respective GTA municipality polygons
function polygon1(i, lat, lon, date, hour, weather, random_list, temperature_list, index_list, variable) {
  //retrieve geojson file for polygons of all GTA municipalities
  fetch('https://ireo00.github.io/472-Resources/all_boundaries.geojson')
  .then(response => response.json())
  .then(response => {
    polygon = response; //assign variable "polygon" to GTA municipality polygons geojson file 
    //loop through all GTA municipality polygons
    for (let count = 0; count < polygon.features.length; count++) {
      //enter conditional if the current looped through centroid falls into the current looped through municipality polygon
      if (turf.pointsWithinPolygon(all_centroids.features[i], polygon.features[count]).features.length > 0) {
        //add retrieved weather condition at current looped through centroid to 'temperature_list', add index of municipality polygon containing respective centroid to 'index_list'
        let polygon_coordinates = polygon.features[count].geometry.coordinates[0][0]
        let temperature = weather.hourly[variable][Math.floor(hour / 3)] 
        polygon.features[count].properties.TEMP = temperature
        temperature_list.push(temperature)
        index_list.push(count)
        //add index of current looped through centroid to 'random_list'
        random_list.push(i)
        //if the current looped through centroid is the last one in the file, call add_property function - only when all the above is done being run (since fetch is asynchronous)
        if (random_list.length == all_centroids.features.length) {
          add_property(random_list, temperature_list, index_list, variable)
        }
      }
    }
  });
}

//create add_property function for determining weather of GTA municipality polygons
function add_property(random_list, temperature_list, index_list, variable) {
  //retrieve geojson file for polygons of all GTA municipalities
  fetch('https://ireo00.github.io/472-Resources/all_boundaries.geojson')
  .then(response => response.json())
  .then(response => {
    polygon2 = response; //assign variable "polygon2" to GTA municipality polygons geojson file 
    //loop through all GTA municipality polygons
    for (j = 0; j < polygon2.features.length; j++) {
      //create a new property 'TEMP' for each municipality polygon and assign it to weather condition at its corresponding centroid
      polygon2.features[j].properties.TEMP = temperature_list[index_list.indexOf(j)]
      //once the last polygon in 'polygon2' is looped through, call work function - only when all the above is done being run (since fetch is asynchronous)
      if (j == polygon2.features.length - 1) {
        work(variable)
      }
    }
  });
}

//create work function for adding choropleth weather to map
function work(variable){
  
  //add a geojson file source "weather" for GTA municipalities (which contains the desired weather conditions at their centroids)
  map.addSource('weather', {
    type: 'geojson',
    data: polygon2,
    'generateId': true,
  });

  //add and style a layer of polygons "weather_polygons" using a continuous colorscale with different specified stops depending on user-selected variable
  if (variable==='temperature_2m'){
    map.addLayer({
      'id': 'weather_polygons',
      'type': 'fill',
      'source': 'weather',
      filter: ['has', 'TEMP'],
      'paint': {
        'fill-color': {
          property: 'TEMP',
          stops: [[-20, 'blue'], [0, '#fff'], [20, 'red']]
        },
        'fill-opacity': 0.5
      },
    });   
  }
  else if (variable==='precipitation'){
  map.addLayer({
    'id': 'weather_polygons',
    'type': 'fill',
    'source': 'weather',
    filter: ['has', 'TEMP'],
    'paint': {
      'fill-color': {
        property: 'TEMP',
        stops: [[0, '#fff'], [20, 'blue']]
      },
    'fill-opacity': 0.5
    },
    });   
  }
  else if (variable==='snowfall'){
    map.addLayer({
      'id': 'weather_polygons',
      'type': 'fill',
      'source': 'weather',
      filter: ['has', 'TEMP'],
      'paint': {
        'fill-color': {
          property: 'TEMP',
          stops: [[0, '#fff'], [7, 'blue']]
        },
        'fill-opacity': 0.5
      },
    });   
  }
  else if (variable==='windspeed_10m'){
    map.addLayer({
      'id': 'weather_polygons',
      'type': 'fill',
      'source': 'weather',
      filter: ['has', 'TEMP'],
      'paint': {
        'fill-color': {
          property: 'TEMP',
          stops: [[0, '#fff'], [50, 'blue']]
        },
        'fill-opacity': 0.5
      },
    });   
  }
  //un-disable weather dropdown now that choropleth is loaded
  document.getElementById('weather').disabled=false;
}

//specify events triggered by clicking the button HTML element with id "returnbutton"
document.getElementById('returnbutton').addEventListener('click', () => {
  //fly back to original view
  map.flyTo({
    center: [-79.266, 43.926],
    zoom: 8.65,
    bearing: -17.7,
    essential: true
  });
});

//specify events triggered by changing the checkbox value of the checkbox HTML element with id "layercheck1" (for the bike shops)
document.getElementById('layercheck1').addEventListener('change', (e) => {
  //change the visibility of the clustered, unclustered, and cluster count layers for the Toronto and GTA bike shops
  map.setLayoutProperty(
    'toronto_bicycle_shop_clustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'toronto_bicycle_shop_unclustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'toronto_bicycle_shop_clustered_count',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'gta_bicycle_shop_clustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'gta_bicycle_shop_unclustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'gta_bicycle_shop_cluster_count',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
});

//specify events triggered by changing the checkbox value of the checkbox HTML element with id "layercheck2" (for the bike shares)
document.getElementById('layercheck2').addEventListener('change', (e) => {
  //change the visibility of the clustered, unclustered, and cluster count layers for the Toronto bike share
  map.setLayoutProperty(
    'toronto_bikeshare_clustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'toronto_bikeshare_cluster_count',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'toronto_bikeshare_unclustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
});

//specify events triggered by changing the checkbox value of the checkbox HTML element with id "layercheck3" (for the bike parkings)
document.getElementById('layercheck3').addEventListener('change', (e) => {
  //change the visibility of the clustered, unclustered, and cluster count layers for the Toronto and GTA bike parkings
  map.setLayoutProperty(
    'toronto_bike_parking_clustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'toronto_bike_parking_cluster_count',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'toronto_bike_parking_unclustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'gta_bike_parking_clustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'gta_bike_parking_unclustered',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
  map.setLayoutProperty(
    'gta_bike_parking_cluster_count',
    'visibility',
    e.target.checked ? 'visible' : 'none'
  );
});

//assign 'label_shops' variable to HTML element with 'label_shops' id
const label_shops = document.getElementById('label_shops'); 
//assign 'item_shops' variable to a created 'section'
const item_shops = document.createElement('div'); 
//assign 'key_shops' variable to a created 'span' (i.e. space into which content can be inserted)
const key_shops = document.createElement('span'); 
//specify the class of 'key_shops' span as 'label-key-shops' such that its style is defined by the latter in css
key_shops.className = 'label-key-shops'; 
//specify the background color of 'key_shops' span
key_shops.style.backgroundColor = '#AC1C54'; 
//assign 'value_shops' variable to a created 'span' (i.e. space into which content can be inserted)
const value_shops = document.createElement('span');  
//insert text into 'value_shops' span
value_shops.innerHTML = 'Bike Shops' 
//add 'key_shops' span to the created section 'item_shops'
item_shops.appendChild(key_shops);  
//add 'value_shops' span to the created section 'item_shops'
item_shops.appendChild(value_shops);  
//add 'item_shops' section into the HTML element assigned to 'label_shops' variable (i.e. add text and icon to the bike shops checkbox)
label_shops.appendChild(item_shops);

//assign 'label_parking' variable to HTML element with 'label_parking' id
const label_parking = document.getElementById('label_parking'); 
//assign 'item_parking' variable to a created 'section'
const item_parking = document.createElement('div'); 
//assign 'key_parking' variable to a created 'span' (i.e. space into which content can be inserted)
const key_parking = document.createElement('span');  
//specify the class of 'key_parking' span as 'label-key-parking' such that its style is defined by the latter in css
key_parking.className = 'label-key-parking';  
//specify the background color of 'key_parking' span
key_parking.style.backgroundColor = '#84BCE4';  
//assign 'value_parking' variable to a created 'span' (i.e. space into which content can be inserted)
const value_parking = document.createElement('span'); 
//insert text into 'value_parking' span
value_parking.innerHTML = 'Bike Parkings' 
//add 'key_parking' span to the created section 'item_parking'
item_parking.appendChild(key_parking);  
//add 'value_parking' span to the created section 'item_parking'
item_parking.appendChild(value_parking); 
//add 'item_parking' section into the HTML element assigned to 'label_parking' variable (i.e. add text and icon to the bike parkings checkbox)
label_parking.appendChild(item_parking);

//assign 'label_bikeshare' variable to HTML element with 'label_bikeshare' id
const label_bikeshare = document.getElementById('label_bikeshare'); 
//assign 'item_bikeshare' variable to a created 'section'
const item_bikeshare = document.createElement('div'); 
//assign 'key_bikeshare' variable to a created 'span' (i.e. space into which content can be inserted)
const key_bikeshare = document.createElement('span'); 
//specify the class of 'key_bikeshare' span as 'label-key-bikeshare' such that its style is defined by the latter in css
key_bikeshare.className = 'label-key-bikeshare'; 
//specify the background color of 'key_bikeshare' span
key_bikeshare.style.backgroundColor = '#147453'; 
//assign 'value_bikeshare' variable to a created 'span' (i.e. space into which content can be inserted)
const value_bikeshare = document.createElement('span'); 
//insert text into 'value_bikeshare' span
value_bikeshare.innerHTML = 'Toronto Bikeshare' 
//add 'key_bikeshare' span to the created section 'item_bikeshare'
item_bikeshare.appendChild(key_bikeshare); 
//add 'value_bikeshare' span to the created section 'item_bikeshare'
item_bikeshare.appendChild(value_bikeshare); 
//add 'item_bikeshare' section into the HTML element assigned to 'label_bikeshare' variable (i.e. add text and icon to the bike shares checkbox)
label_bikeshare.appendChild(item_bikeshare);


//specify events triggered by changing the value of the dropdown menu HTML element with id "weathertype" (for the weather conditions)
document.getElementById("weathertype").addEventListener('change', (e) => {
  //assign 'weathertype' variable to the selected weather conditions
  weathertype = document.getElementById('weather').value;
  //if choropleth polygons were already present on the map, remove their source and layer
  if (map.getLayer('weather_polygons')) {
    map.removeLayer('weather_polygons');
  }
  if (map.getSource('weather')) {
    map.removeSource('weather');
  }
  //if a colorbar legend was already present on the map for prior choropleth weather polygons, remove it
  if (legend_colorbar.hasChildNodes()){
    legend_colorbar.removeChild(legend_colorbar.lastElementChild)
  }
  //reinitialize the title of the weather legend to be empty
  legend_weather_title.innerHTML=''
  //enter conditional if 'Temperature' is selected in the weather dropdown
  if (weathertype == 'Temperature') {
    //disable the weather dropdown (until choropleth is fully loaded)
    document.getElementById('weather').disabled=true;
    //call weather_api function (which will trigger a sequence of functions to plot temperature)
    weather_api('temperature_2m');
    //add an image of the colorbar in the legend and specify legend title
    const legend_colorbar = document.getElementById('legend_colorbar');
    const colorbar = document.createElement('img');
    colorbar.src="https://anamariiaz.github.io/GGR472-Group-Project-Sources/temperature_colorbar.png";
    colorbar.style.height = '200px';
    colorbar.style.width = 'auto';
    legend_colorbar.appendChild(colorbar);
    const legend_weather_title = document.getElementById('legend_weather_title');
    legend_weather_title.innerHTML='Temperature at 2m above ground'
  } 
  //enter conditional if 'Precipitation' is selected in the weather dropdown
  else if (weathertype == 'Precipitation') {
    //disable the weather dropdown (until choropleth is fully loaded)
    document.getElementById('weather').disabled=true;
    //call weather_api function (which will trigger a sequence of functions to plot total precipitation)
    weather_api('precipitation');
    //add an image of the colorbar in the legend and specify legend title
    const legend_colorbar = document.getElementById('legend_colorbar');
    const colorbar = document.createElement('img');
    colorbar.src="https://anamariiaz.github.io/GGR472-Group-Project-Sources/precipitation_colorbar.png";
    colorbar.style.height = '200px';
    colorbar.style.width = 'auto';
    legend_colorbar.appendChild(colorbar);
    const legend_weather_title = document.getElementById('legend_weather_title');
    legend_weather_title.innerHTML='Total precipitation sum of preceding hour'
  }
  //enter conditional if 'Snowfall' is selected in the weather dropdown
  else if (weathertype == 'Snowfall') {
    //disable the weather dropdown (until choropleth is fully loaded)
    document.getElementById('weather').disabled=true;
    //call weather_api function (which will trigger a sequence of functions to plot snow)
    weather_api('snowfall');
    //add an image of the colorbar in the legend and specify legend title
    const legend_colorbar = document.getElementById('legend_colorbar');
    const colorbar = document.createElement('img');
    colorbar.src="https://anamariiaz.github.io/GGR472-Group-Project-Sources/snowfall_colorbar.png";
    colorbar.style.height = '200px';
    colorbar.style.width = 'auto';
    legend_colorbar.appendChild(colorbar);
    const legend_weather_title = document.getElementById('legend_weather_title');
    legend_weather_title.innerHTML='Total snowfall sum of preceding hour'
  }
  //enter conditional if 'Wind Speed' is selected in the weather dropdown
  else if (weathertype == 'Wind Speed') {
    //disable the weather dropdown (until choropleth is fully loaded)
    document.getElementById('weather').disabled=true;
    //call weather_api function (which will trigger a sequence of functions to plot wind speed)
    weather_api('windspeed_10m')
    //add an image of the colorbar in the legend and specify legend title
    const legend_colorbar = document.getElementById('legend_colorbar');
    const colorbar = document.createElement('img');
    colorbar.src="https://anamariiaz.github.io/GGR472-Group-Project-Sources/windspeed_colorbar.png";
    colorbar.style.height = '200px';
    colorbar.style.width = 'auto';
    legend_colorbar.appendChild(colorbar);
    const legend_weather_title = document.getElementById('legend_weather_title');
    legend_weather_title.innerHTML='Windspeed at 10m above ground'
  }
});

//Filter data layer to show selected bike lane type from dropdown selection
let tobikelane;

//specify events triggered by changing the value of the dropdown menu HTML element with id "tobikelanetype" (for the street variable)
document.getElementById("tobikelanetype").addEventListener('change', (e) => {
  //assign 'tobikelane' variable to the selected street variable (bike lane type or traffic)
  tobikelane = document.getElementById('bikelane').value;
  //assign 'legend_discrete' to div section for street variable legend
  const legend_discrete = document.getElementById('legend_discrete');
  //reinitialize legend content (remove any prior legend items) 
  while (legend_discrete.firstChild) {
    legend_discrete.removeChild(legend_discrete.lastChild);
  }
  //enter conditional if 'Show All' is selected in the dropdown
  if (tobikelane == 'All') {
    //call bikeways_legend function to create the legend
    bikeways_legend()
    //update legend title
    const legend_bikeways_title = document.getElementById('legend_bikeways_title');
    legend_bikeways_title.innerHTML='Bikeways'
    //set all bikeways layers to visible
    map.setLayoutProperty(
      'toronto_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'york_region_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'peel_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'durham_region_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'ajax_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'whitby_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'milton_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'burlington_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'oakvill_bikeways',
      'visibility',
      'visible'
    );
    //remove traffic layer
    map.setLayoutProperty(
      'traffic',
      'visibility',
      'none'
    );
    //reset filter to include all bikeways
    map.setFilter(
        'toronto_bikeways',
        ['has', 'Classification'] //returns all lines from layer that have a value in type field (type!!)
    );
    map.setFilter(
      'york_region_bikeways',
      ['has', 'Classification'] //returns all lines from layer that have a value in Classification field
    );

    map.setFilter(
      'peel_bikeways',
      ['has', 'Classification'] //returns all lines from layer that have a value in Classification field
    );

    map.setFilter(
      'durham_region_bikeways',
      ['has', 'classification'] //returns all lines from layer that have a value in classification field
    );

    map.setFilter(
      'ajax_bikeways',
      ['has', 'classification'] //returns all lines from layer that have a value in classification field
    );

    map.setFilter(
      'whitby_bikeways',
      ['has', 'classification'] //returns all lines from layer that have a value in classification field
    );

    map.setFilter(
      'milton_bikeways',
      ['has', 'classification'] //returns all lines from layer that have a value in classification field
    );

    map.setFilter(
      'burlington_bikeways',
      ['has', 'Classification'] //returns all lines from layer that have a value in Classification field
    );

    map.setFilter(
      'oakvill_bikeways',
      ['has', 'Classification'] //returns all lines from layer that have a value in Classification field
    );
  } 
  //enter conditional if a single bikeway type is selected in dropdown
  else if (tobikelane != 'All' && tobikelane != 'Traffic') {
    //call bikeways_legend function to create the legend
    bikeways_legend()
    //update legend title
    const legend_bikeways_title = document.getElementById('legend_bikeways_title');
    legend_bikeways_title.innerHTML='Bikeways'
    //set all bikeways layers to visible
    map.setLayoutProperty(
      'toronto_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'york_region_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'peel_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'durham_region_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'ajax_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'whitby_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'milton_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'burlington_bikeways',
      'visibility',
      'visible'
    );
    map.setLayoutProperty(
      'oakvill_bikeways',
      'visibility',
      'visible'
    );
    //remove traffic layer
    map.setLayoutProperty(
      'traffic',
      'visibility',
      'none'
    );
    //filter bikeways such that only those whose (lowercase) 'Classification' field value matches the selected bikeway are shown
    map.setFilter(
      'toronto_bikeways',
      ['==', ['downcase', ['get', 'Classification']], ['downcase', tobikelane]] //returns bikeways with Classification value that matches dropdown selection
    );
    map.setFilter(
      'york_region_bikeways',
      ['==', ['downcase', ['get', 'Classification']], ['downcase', tobikelane]] //returns bikeways with Classification value that matches dropdown selection
    );
    map.setFilter(
      'peel_bikeways',
      ['==', ['downcase', ['get', 'Classification']], ['downcase', tobikelane]] //returns bikeways with Classification value that matches dropdown selection
    );
    map.setFilter(
      'durham_region_bikeways',
      ['==', ['downcase', ['get', 'classification']], ['downcase', tobikelane]] //returns bikeways with Classification value that matches dropdown selection
    );
    map.setFilter(
      'ajax_bikeways',
      ['==', ['downcase', ['get', 'classification']], ['downcase', tobikelane]] //returns bikeways with Classification value that matches dropdown selection
    );
    map.setFilter(
      'whitby_bikeways',
      ['==', ['downcase', ['get', 'classification']], ['downcase', tobikelane]] //returns bikeways with Classification value that matches dropdown selection
    );
    map.setFilter(
      'milton_bikeways',
      ['==', ['downcase', ['get', 'classification']], ['downcase', tobikelane]] //returns bikeways with Classification value that matches dropdown selection
    );
    map.setFilter(
      'burlington_bikeways',
      ['==', ['downcase', ['get', 'Classification']], ['downcase', tobikelane]] //returns bikeways with Classification value that matches dropdown selection
    );
    map.setFilter(
      'oakvill_bikeways',
      ['==', ['downcase', ['get', 'Classification']], ['downcase', tobikelane]] //returns bikeways with Classification value that matches dropdown selection
    );
  }
  //enter conditional if 'Traffic' is selected in the dropdown
  else if (tobikelane == 'Traffic') {
    //call traffic_legend function to create legend
    traffic_legend()
    //update legend title
    const legend_bikeways_title = document.getElementById('legend_bikeways_title');
    legend_bikeways_title.innerHTML='Traffic'
    //set traffic layer to visible
    map.setLayoutProperty(
      'traffic',
      'visibility',
      'visible'
    );
    //remove all bikeway layers
    map.setLayoutProperty(
      'toronto_bikeways',
      'visibility',
      'none'
    );
    map.setLayoutProperty(
      'york_region_bikeways',
      'visibility',
      'none'
    );
    map.setLayoutProperty(
      'peel_bikeways',
      'visibility',
      'none'
    );
    map.setLayoutProperty(
      'durham_region_bikeways',
      'visibility',
      'none'
    );
    map.setLayoutProperty(
      'ajax_bikeways',
      'visibility',
      'none'
    );
    map.setLayoutProperty(
      'whitby_bikeways',
      'visibility',
      'none'
    );
    map.setLayoutProperty(
      'milton_bikeways',
      'visibility',
      'none'
    );
    map.setLayoutProperty(
      'burlington_bikeways',
      'visibility',
      'none'
    );
    map.setLayoutProperty(
      'oakvill_bikeways',
      'visibility',
      'none'
    );
  }
});

//create section for legend of bikeways/traffic on initial load
legend_content.style.display='block'
//initialize legend title as 'Bikeways' and set its initial state as open (such that it can be collapsed)
const legend_bikeways_title = document.getElementById('legend_bikeways_title');
legend_bikeways_title.innerHTML='Bikeways'
legend_collapsible = document.getElementById('legend_collapsible');
if (legend_collapsible.hasChildNodes()==false){
  legend_collapsible.appendChild(document.createTextNode("Collapse Legend"))
}

//call bikways_legend function to populate the legend 
bikeways_legend()

//create bikeways_legend function for legend of GTA bikeways
function bikeways_legend(){
  //assign variable 'legendlabels' to a list of labels for the bikeways legend
  const legendlabels = [
    'Bike Lane',
    'Multi-use Trail', 
    'Sharrows', 
    'Cycle Track',
    'Paved Shoulder',
    'Hiking/Park Trail'
  ];
  //assign variable 'legendcolours' to a list of colours for the bikeways legend
  const legendcolours = [
    '#FC6468',
    '#0072B2',
    '#8B4DAB',
    '#FFB900',
    '#C11F73',
    '#009E73'
  ];
  //assign 'legend' variable to HTML element with 'legend_discrete' id and set title
  const legend_discrete = document.getElementById('legend_discrete');
  const legend_bikeways_title = document.getElementById('legend_bikeways_title');
  legend_bikeways_title.innerHTML='Bikeways'
  //loop through the legend labels in the 'legendlabels' variable
  legendlabels.forEach((label, i) => {
    //assign 'color' variable to the corresponding color of the 'legendcolours' variable
    const color = legendcolours[i];
    //assign 'item' variable to a created 'section'
    const item = document.createElement('div'); 
    //assign 'key' variable to a created 'span' (i.e. space into which content can be inserted)
    const key = document.createElement('span'); 
    //specify the class of 'key' span as 'legend-key' such that its style is defined by the latter in css
    key.className = 'legend-key'; 
    //specify the background color of 'key' span using the 'color' variable
    key.style.backgroundColor = color; 
    //assign 'value' variable to a created 'span' (i.e. space into which content can be inserted)
    const value = document.createElement('span'); 
    //insert text into 'value' span from the 'legendlabels' list being looped through
    value.innerHTML = `${label}`; 
    //add 'key' span to the created section 'item'
    item.appendChild(key); 
    //add 'value' span to the created section 'item'
    item.appendChild(value); 
    //add 'item' section into the HTML element assigned to 'legend' variable
    legend_discrete.appendChild(item); 
  });
}

//create traffic_legend function for legend of traffic layer
function traffic_legend(){
  //assign variable 'legendlabels' to a list of labels for the traffic legend
  const legendlabels = [
    'Low',
    'Moderate', 
    'Heavy', 
    'Severe'
  ];
  //assign variable 'legendcolours' to a list of colours for the traffic legend
  const legendcolours = [
    'green',
    '#ffff00',
    'orange',
    'red'
  ];
  //assign 'legend' variable to HTML element with 'legend_discrete' id and set title
  const legend_discrete = document.getElementById('legend_discrete');
  
  //loop through the legend labels in the 'legendlabels' variable
  legendlabels.forEach((label, i) => {
    //assign 'color' variable to the corresponding color of the 'legendcolours' variable
    const color = legendcolours[i];
    //assign 'item' variable to a created 'section'
    const item = document.createElement('div'); 
    //assign 'key' variable to a created 'span' (i.e. space into which content can be inserted)
    const key = document.createElement('span'); 
    //specify the class of 'key' span as 'legend-key' such that its style is defined by the latter in css
    key.className = 'legend-key'; 
    //specify the background color of 'key' span using the 'color' variable
    key.style.backgroundColor = color; 
    //assign 'value' variable to a created 'span' (i.e. space into which content can be inserted)
    const value = document.createElement('span'); 
    //insert text into 'value' span from the 'legendlabels' list being looped through
    value.innerHTML = `${label}`; 
    //add 'key' span to the created section 'item'
    item.appendChild(key); 
    //add 'value' span to the created section 'item'
    item.appendChild(value); 
    //add 'item' section into the HTML element assigned to 'legend' variable
    legend_discrete.appendChild(item); 
  });
}

//specify events triggered by clicking the 'Expand/Collapse Legend' button with HTML id "legend_collapsible" (for toggling the legend)
document.getElementById('legend_collapsible').addEventListener('click',(e) => { 
  //assign 'legend_content' to the content of the collapsible legend  
  var legend_content = document.getElementById('legend_content');
  //if this content was already open
  if (legend_content.style.display === "block") {
    //close it
    legend_content.style.display = "none";
    //change legend text to 'Expand Legend'
    legend_collapsible.innerText= "Expand Legend";
  }
  //if this content was closed
  else {
    //open it
    legend_content.style.display = "block";
    //change legend text to 'Collapse Legend'
    legend_collapsible.innerText= "Collapse Legend";
  }
});
