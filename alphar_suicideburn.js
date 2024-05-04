"use strict"
const { createClient, spaceCenter } = require("krpc-node");

class Main {
    constructor() {
        this.client;
        this.vessel;
        this.control;
        this.orbitalReference;
        this.flight;
        this.altitude;
        this.burn = false;
        this.speed;
        this.mass;
        this.gravity = 9.81;
        this.burned = false;
        this.velocity1 = 0;
        this.velocity2 = 0;
    }

    speedDecoder() {
        setInterval(async() => {
            if (this.velocity1 == 0 && this.altitude) {
                this.velocity1 = this.altitude;
            } else if (this.velocity2 == 0 && this.altitude && this.velocity1 && this.velocity1 != this.altitude) {
                this.velocity2 = this.altitude;
            } else if (this.velocity1 && this.velocity2 ) {
                this.speed = (this.velocity2 - this.velocity1) * 10;
                this.velocity1 = 0;
                this.velocity2 = 0;
            }
        }, 100)
    }

    async suicideBurn() {
        console.log("suicide burn on")

        if (!this.burned) {
            this.burned = true;
            this.control.sas.set(1);
            this.control.sasMode.set("Retrograde");
            this.control.throttle.set(1)
            setTimeout(() => {
                this.control.throttle.set(0)
            }, 1000)
        }

        if (this.altitude <= 1500) {
            this.control.legs.set(1);
            const motorForce = await this.vessel.availableThrust.get() / (this.mass * this.gravity);
            const aceleration = motorForce * this.gravity;
            const timeToGround = this.altitude / -(this.speed);
            const time = -(this.speed) / aceleration;

            console.log("Tempo ate o chao: " + timeToGround);
            console.log("Tempo: " + time);

            if (timeToGround <= time) {
                if (this.speed < -2) {
                    this.control.throttle.set(1);
                } else {
                    this.control.throttle.set(0);
                }
            } else {
                this.control.throttle.set(0);
            }
        }

        if (this.altitude <= 8) {
            this.control.throttle.set(0);
            this.burn = false;

            setTimeout(async() => {
                this.control.sas.set(1);
                console.log("Desligando Sistemas...")
                await this.client.close();
            }, 3000)
        }
    }

    loop() {
        setInterval(async() => {
            this.altitude = await this.flight.surfaceAltitude.get();
            console.log("ALPHAR LOGS: Altitude: " + this.altitude + ", Mass: " + this.mass + ", Speed: " + this.speed);

            if (this.burn) {
                this.suicideBurn();
            }

            if (this.speed < 0) {
                this.burn = true;
                this.control.throttle.set(0);
            }
        }, 100)
    }

    async init() {
        this.client = await createClient();

        try {
            this.vessel = await this.client.send(spaceCenter.getActiveVessel());
            this.control = await this.vessel.control.get();
            this.orbitalReference = await this.vessel.orbitalReferenceFrame.get();
            this.flight = await this.vessel.flight(this.orbitalReference);
            this.altitude = await this.flight.surfaceAltitude.get();
            this.mass = await this.vessel.mass.get();

            this.loop();
            this.speedDecoder();
        } catch (err) {
            await this.client.close();
            console.error(err);
        }
    }
}

const RUN = new Main().init();