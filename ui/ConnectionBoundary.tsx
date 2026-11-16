"use client";
import {Component,type ReactNode} from 'react';

/** Chunk/network failures release the scene and offer an explicit recovery action. */
export default class ConnectionBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(!this.state.failed)return this.props.children;
    return <main className="roam-launch" role="alert">
      <section>
        <p>TARUKH</p>
        <h1>This part of Mars could not load</h1>
        <p>Check your connection, then try again. Your saved mission stays on this device.</p>
        <button className="roam-primary" autoFocus onClick={()=>window.location.reload()}>Try again</button>
      </section>
    </main>;
  }
}
