'use strict';
const { createClient, spaceCenter } = require("krpc-node");

class Main {
    constructor() {
        this.client;
        this.vessel;
        this.orbit;
        this.body;
        this.control;
        this.orbitalReference;
        this.flight;
        this.altitude;
        this.burn = false;
        this.speed;
        this.mass;
        this.gravity;
        this.burned = false;
        this.velocity1 = 0;
        this.velocity2 = 0;
        this.falled = false;
        this.closed;
        this.ground = 5;
        this.autoThrottle = false;
    }

    speedDecoder() {
        let speedV = setInterval(async() => {
            if (this.velocity1 == 0 && this.altitude) {
                this.velocity1 = this.altitude;
            } else if (this.velocity2 == 0 && this.altitude && this.velocity1 && this.velocity1 != this.altitude) {
                this.velocity2 = this.altitude;
            } else if (this.velocity1 && this.velocity2 ) {
                this.speed = ((this.velocity2 - this.velocity1) * 10);
                this.velocity1 = 0;
                this.velocity2 = 0;
            }

            if (this.closed) {
                clearInterval(speedV);
            }
        }, 100)
    }

    async suicideBurn() {
        if (!this.burned) {
            this.burned = true;
            await this.control.throttle.set(0);
            await this.control.sas.set(1);
            await this.control.rcs.set(1);
            setTimeout(async() => {
                await this.control.sasMode.set("Retrograde");
                console.log("ALPHAR_LOGS: SUICIDE-BURN ON");
            }, 1000)
        }

        if (this.altitude <= 1500) {
            const motorForce = await this.vessel.availableThrust.get() / (this.mass * this.gravity);
            const aceleration = motorForce * this.gravity;
            const timeToGround = this.altitude / -(this.speed);
            const time = -(this.speed) / aceleration;

            if (timeToGround <= time) {
                if (this.speed < -2) {
                    this.autoThrottle = true;
                    await this.control.throttle.set(1);
                    await this.control.legs.set(1);
                } else {
                    await this.control.throttle.set(0);
                }
            } else if (this.autoThrottle == true) {
                this.autoThrottle == false;
                await this.control.throttle.set(0);
            }
        }

        if (this.altitude <= this.ground && this.falled) {
            await this.control.throttle.set(0);
            this.burn = false;
            console.log("ALPHAR_LOGS: SUCCESS IN LADING");

            if (!this.closed) {
                this.closed = true;

                setTimeout(async() => {
                    await this.control.sas.set(0);
                    await this.control.rcs.set(0);
                    console.log("ALPHAR_LOGS: TURNING OFF THE SYSTEM...");
                    await this.client.close();
                }, 3000)
            }
        }
    }

    loop() {
        let loopV = setInterval(async() => {
            this.altitude = await this.flight.surfaceAltitude.get();

            if (this.burn) {
                this.suicideBurn();
            }

            if (this.speed < -0.1) {
                this.falled = true;
                this.burn = true;
            }

            if (this.closed) {
                clearInterval(loopV);
            }
        }, 100)
    }

    async init() {
        this.client = await createClient();

        try {
            this.vessel = await this.client.send(spaceCenter.getActiveVessel());
            this.orbit = await this.vessel.orbit.get();
            this.body = await this.orbit.body.get();
            this.gravity = await this.body.gravitationalParameter.get() / Math.pow(await this.body.equatorialRadius.get(), 2);
            this.control = await this.vessel.control.get();
            this.orbitalReference = await this.vessel.orbitalReferenceFrame.get();
            this.flight = await this.vessel.flight(this.orbitalReference);
            this.altitude = await this.flight.surfaceAltitude.get();
            this.mass = await this.vessel.mass.get();
            console.log("ALPHAR_LOGS: ALPHAR system on");

            this.loop();
            this.speedDecoder();
        } catch (err) {
            await this.client.close();
            console.error(err);
        }
    }
}

const RUN = new Main().init();