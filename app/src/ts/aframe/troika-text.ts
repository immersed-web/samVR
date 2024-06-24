import { Text } from 'troika-three-text';
export default function () {
  AFRAME.registerComponent('troika-test', {
    init: function() {
      const text = new Text();
      text.text= 'Hello'
      

      this.el.object3D.add(text);
    }
  });
}