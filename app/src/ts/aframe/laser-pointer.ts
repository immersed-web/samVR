import type { DetailEvent, Entity, THREE } from 'aframe';

export default function () {

  AFRAME.registerComponent('laser-pointer', {
      init: function () {
      },
      events: {
        'bbuttondown': function (evt) {
          this.laserOn()
        },
        'bbuttonup': function (evt) {
          this.laserOff()
        },
      },
      laserOn: function () {
        this.el.emit('laser-active-toggle', {value: true});
      },
      laserOff: function () {
        this.el.emit('laser-active-toggle', {value: false});
      }
  });
}