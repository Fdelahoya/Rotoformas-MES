/** Configuracion administrativa autorizada; no crea trabajos de impresion. */
function activarZebraMES() {
  assertLotsWebAppAccess_();
  const props = PropertiesService.getScriptProperties();
  props.setProperties({RPI_SCALE_ENABLED:'true', RPI_PRINT_ENABLED:'true', RPI_LASER_ENABLED:'false'}, false);
  console.log(JSON.stringify({
    RPI_SCALE_ENABLED: props.getProperty('RPI_SCALE_ENABLED'),
    RPI_PRINT_ENABLED: props.getProperty('RPI_PRINT_ENABLED'),
    RPI_LASER_ENABLED: props.getProperty('RPI_LASER_ENABLED')
  }));
}

/** Habilita la actualizacion de V1; el marcado sigue siendo manual. */
function activarLaserV1MES() {
  assertLotsWebAppAccess_();
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('RPI_PRINT_ENABLED') !== 'true') throw new Error('Activa primero la impresion Zebra.');
  props.setProperty('RPI_LASER_ENABLED', 'true');
  console.log(JSON.stringify({
    RPI_SCALE_ENABLED: props.getProperty('RPI_SCALE_ENABLED'),
    RPI_PRINT_ENABLED: props.getProperty('RPI_PRINT_ENABLED'),
    RPI_LASER_ENABLED: props.getProperty('RPI_LASER_ENABLED')
  }));
}
