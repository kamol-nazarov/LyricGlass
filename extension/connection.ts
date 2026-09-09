// Reconnects never queue playback. Every successful auth requests current tab snapshots.
export class ConnectionState {
  ready=false;attempt=0;
  connected(){this.ready=true;this.attempt=0;}
  disconnected(){this.ready=false;}
  nextDelay(){return Math.min(30000,1000*2**Math.min(this.attempt++,5));}
  canSend(){return this.ready;}
}
