import type { ReactNode } from 'react';

const F = ({ children }: { children: ReactNode }) => <p className="study-lesson-equation">{children}</p>;
const Diagram = ({ name, caption }: { name: string; caption: string }) => <figure>
  <img src={`/study/lessons/motion11-${name}.webp`} alt={caption} loading="lazy"/>
  <figcaption>{caption}</figcaption>
</figure>;

/** Full reading edition of Physics_11_2B.pdf (Telegram 401), pages 1–16.
 * Only repeated running headers, footers and page breaks have been removed.
 * The five figures are crops of the original vector diagrams, rendered at 220 dpi.
 */
export function Motion11Lesson() {
  return <>
    <section>
      <h3>1. Basic Kinematic Quantities</h3>
      <p><strong>Kinematics</strong> is the branch of mechanics that describes the motion of objects without considering the causes of that motion.</p>
      <p>In kinematics, we study the motion of a particle with time and the dependence of kinematic quantities on time. The causes of motion are studied in <strong>dynamics</strong>.</p>
      <p>The main quantities used to describe motion are:</p>
      <div className="study-lesson-table" tabIndex={0} role="region" aria-label="Lesson table. Use the arrow keys to scroll."><table><thead><tr><th>Quantity</th><th>Symbol</th><th>Physical meaning</th></tr></thead><tbody>
        <tr><td>Position</td><td>x</td><td>Location of an object relative to a chosen origin</td></tr>
        <tr><td>Distance</td><td>s</td><td>Total length of the path travelled by an object</td></tr>
        <tr><td>Displacement</td><td>Δx</td><td>Change in position, including direction</td></tr>
        <tr><td>Velocity</td><td>v</td><td>Rate of change of displacement</td></tr>
        <tr><td>Acceleration</td><td>a</td><td>Rate of change of velocity</td></tr>
        <tr><td>Time</td><td>t</td><td>Duration of motion</td></tr>
      </tbody></table></div>
    </section>
    <section>
      <h3>2. Distance and Displacement</h3>
      <h4>Distance</h4>
      <p><strong>Distance</strong> is the total length of the path travelled by an object. Distance is a <strong>scalar quantity</strong>. Therefore,</p>
      <F>s ≥ 0.</F>
      <p>It has magnitude but no direction.</p>
      <h4>Displacement</h4>
      <p><strong>Displacement</strong> is a directed straight-line segment connecting the initial and final positions of an object.</p>
      <p><strong>Physical meaning:</strong> displacement shows how far and in which direction an object has moved relative to its initial position.</p>
      <p>For one-dimensional motion:</p><F>Δx = x − x₀</F>
      <p>where x₀ is the initial position and x is the final position.</p>
      <p>For motion with constant acceleration:</p>
      <F>Δx = v₀t + at²/2</F><F>Δx = (v² − v₀²)/(2a)</F><F>Δx = ((v + v₀)/2)t</F>
      <p>Using calculus:</p><F>Δx = ∫<sub>t₁</sub><sup>t₂</sup> v(t) dt</F>
      <aside className="study-lesson-callout"><p><strong>Key idea:</strong> displacement is the integral of velocity with respect to time because velocity describes the rate at which displacement changes.</p>
        <p>Distance and the magnitude of displacement are equal only when an object moves along a straight line without changing direction.</p></aside>
    </section>
    <section>
      <h3>3. Speed and Velocity</h3>
      <h4>Speed</h4>
      <p><strong>Speed</strong> is a scalar physical quantity that describes how fast an object moves. Average speed is:</p>
      <F>v<sub>speed,avg</sub> = total distance travelled / total time</F>
      <p>Speed has no direction and cannot be negative.</p>
      <h4>Velocity</h4>
      <p><strong>Velocity</strong> is a vector physical quantity that describes the rate of displacement in a given direction.</p>
      <p><strong>Physical meaning:</strong> velocity shows how fast and in which direction the displacement of an object changes with time.</p>
      <p>Average velocity:</p><F>v<sub>avg</sub> = Δx/Δt</F>
      <p>For uniform motion:</p><F>v<sub>x</sub> = Δx/Δt</F>
      <p>For motion with constant acceleration:</p><F>v<sub>x</sub> = v<sub>0x</sub> + a<sub>x</sub>t</F>
      <p>and</p><F>v<sub>avg</sub> = (v₀ + v)/2</F>
      <p>Using calculus:</p><F>v<sub>x</sub>(t) = dx/dt</F>
      <p>and, more generally,</p><F>v<sub>x</sub>(t) = v<sub>0x</sub> + ∫<sub>0</sub><sup>t</sup> a<sub>x</sub>(t) dt</F>
      <aside className="study-lesson-callout"><p><strong>Key idea:</strong> velocity is the derivative of position with respect to time. The change in velocity is the integral of acceleration with respect to time.</p></aside>
      <p><strong>Do not confuse speed and velocity.</strong> Speed is based on <strong>distance</strong> and is a scalar. Velocity is based on <strong>displacement</strong> and is a vector.</p>
    </section>
    <section>
      <h3>4. Acceleration</h3>
      <p><strong>Acceleration</strong> is a physical quantity that characterises the rate of change of velocity.</p>
      <p><strong>Physical meaning:</strong> acceleration shows how quickly velocity changes per unit time.</p>
      <p>Average acceleration:</p><F>a<sub>x</sub> = (v<sub>x</sub> − v<sub>0x</sub>)/Δt</F>
      <p>or</p><F>a = Δv/Δt</F>
      <p>Using calculus:</p><F>a<sub>x</sub>(t) = dv<sub>x</sub>/dt</F>
      <p>For constant acceleration:</p><F>v<sub>x</sub> = v<sub>0x</sub> + a<sub>x</sub>t</F>
      <p>The SI unit of acceleration is:</p><F>[a] = m/s².</F>
      <aside className="study-lesson-callout"><p><strong>Important:</strong> a negative acceleration does not necessarily mean that an object is slowing down. If velocity and acceleration have the same direction, the magnitude of velocity increases. If velocity and acceleration have opposite directions, the magnitude of velocity decreases.</p></aside>
    </section>
    <section>
      <h3>5. Position of an Object</h3>
      <p>For uniformly accelerated motion:</p><F>x = x₀ + v<sub>0x</sub>t + a<sub>x</sub>t²/2</F>
      <p>For uniform motion:</p><F>x = x₀ + v<sub>x</sub>t</F>
      <p>The fundamental relationship between position, velocity and acceleration is:</p>
      <F>x(t) ⟶ [d/dt] v<sub>x</sub>(t) ⟶ [d/dt] a<sub>x</sub>(t)</F>
      <p>In the opposite direction:</p><F>a<sub>x</sub>(t) ⟶ [∫ dt] v<sub>x</sub>(t) ⟶ [∫ dt] x(t)</F>
    </section>
    <section>
      <h3>6. Motion with Constant Acceleration</h3>
      <p>When acceleration is constant:</p><F>v = v₀ + at</F>
      <p>Displacement is:</p><F>Δx = v₀t + at²/2</F>
      <p>The equation that does not contain time is:</p><F>v² = v₀² + 2aΔx</F>
      <p>Average velocity for constant acceleration is:</p><F>v<sub>avg</sub> = (v₀ + v)/2</F>
      <p>Therefore:</p><F>Δx = ((v₀ + v)/2)t</F>
      <aside className="study-lesson-callout"><p><strong>Choosing an equation:</strong> use the equation containing the quantities that are given in the problem and the quantity you need to determine. Always choose a positive direction before substituting vector components into the equations.</p></aside>
    </section>
    <section>
      <h3>7. Example: Constant Acceleration</h3>
      <p>A car has an initial velocity of</p><F>v₀ = 5 m/s</F>
      <p>and moves with a constant acceleration of</p><F>a = 2 m/s².</F>
      <p>Find its displacement after <strong>4 seconds</strong>.</p>
      <p>Use:</p><F>Δx = v₀t + at²/2.</F>
      <p>Substitute the values:</p><F>Δx = 5(4) + 2(4)²/2.</F><F>Δx = 20 + 16.</F>
      <p>Therefore,</p><F>Δx = 36 m</F>
      <p>The final velocity is:</p><F>v = v₀ + at</F><F>v = 5 + 2(4)</F><F>v = 13 m/s</F>
    </section>
    <section>
      <h3>8. Position–Time Graph</h3>
      <p>A position–time graph shows how the position of an object changes with time.</p>
      <Diagram name="position-time" caption="Position–time graph for uniform motion: x = x₀ + vt."/>
      <p>For uniform motion, the position–time graph is a straight line. Its gradient represents velocity:</p><F>v = Δx/Δt</F>
      <p>For instantaneous velocity:</p><F>v = dx/dt</F>
      <p>A steeper gradient corresponds to a greater magnitude of velocity.</p>
      <aside className="study-lesson-callout"><p><strong>Position–time graph:</strong></p><F>gradient = velocity</F><p>A horizontal line means that the object is at rest.</p></aside>
    </section>
    <section>
      <h3>9. Velocity–Time Graph</h3>
      <p>For motion with constant acceleration:</p><F>v = v₀ + at.</F>
      <p>Therefore, the velocity–time graph is a straight line.</p>
      <Diagram name="velocity-time" caption="Velocity–time graph with constant acceleration: v = v₀ + at."/>
      <p>The gradient of a velocity–time graph represents acceleration:</p><F>a = Δv/Δt</F>
      <p>For instantaneous acceleration:</p><F>a = dv/dt</F>
    </section>
    <section>
      <h3>10. Area Under a Velocity–Time Graph</h3>
      <p>The signed area under a velocity–time graph represents <strong>displacement</strong>.</p><F>Δx = ∫ v(t) dt</F>
      <p>For constant velocity:</p><F>Δx = vt.</F>
      <p>Geometrically, this is the area of a rectangle.</p>
      <Diagram name="displacement-area" caption="The rectangular area under the constant-velocity graph is Δx = vt."/>
      <p>For constant acceleration, the area can be divided into a rectangle and a triangle:</p><F>Δx = v₀t + (v − v₀)t/2.</F>
      <p>Since</p><F>v − v₀ = at,</F><p>we obtain:</p><F>Δx = v₀t + at²/2</F>
      <aside className="study-lesson-callout"><p>An area below the time axis corresponds to <strong>negative displacement</strong>. The total distance travelled is found by adding the magnitudes of all areas, regardless of whether they lie above or below the time axis.</p></aside>
    </section>
    <section>
      <h3>11. Acceleration–Time Graph</h3>
      <p>If acceleration is constant:</p><F>a = constant.</F>
      <p>The graph is a horizontal straight line.</p>
      <Diagram name="acceleration-time" caption="Acceleration–time graph: a = constant."/>
      <p>The signed area under an acceleration–time graph represents the change in velocity:</p><F>Δv = ∫ a(t) dt</F>
      <p>For constant acceleration:</p><F>Δv = at</F>
      <aside className="study-lesson-callout"><p><strong>Remember:</strong></p><F>x–t: gradient = v</F><F>v–t: gradient = a, area = Δx</F><F>a–t: area = Δv</F></aside>
    </section>
    <section>
      <h3>12. Motion in a Gravitational Field</h3>
      <p>Near the surface of the Earth, an object moving only under the influence of gravity has an approximately constant acceleration:</p><F>g ≈ 9.8 m/s²</F>
      <p>The gravitational acceleration is always directed vertically downward. If the positive y-direction is chosen upward:</p><F>a<sub>y</sub> = −g</F>
      <p>Therefore:</p><F>v<sub>y</sub> = v<sub>0y</sub> − gt</F><p>and</p><F>y = y₀ + v<sub>0y</sub>t − gt²/2</F>
      <p>Neglecting air resistance, all objects at the same location have the same gravitational acceleration regardless of their mass.</p>
    </section>
    <section>
      <h3>13. Free Fall</h3>
      <p>If an object is released from rest:</p><F>v₀ = 0.</F>
      <p>Taking downward as the positive direction:</p><F>v = gt</F><p>and</p><F>h = gt²/2</F>
      <p>The time of fall from a height h is:</p><F>t = √(2h/g)</F>
      <p>The speed after falling through a vertical distance h is:</p><F>v = √(2gh)</F>
    </section>
    <section>
      <h3>14. Vertical Projection</h3>
      <p>Suppose an object is projected vertically upward with initial velocity v₀. Choosing upward as positive:</p><F>v = v₀ − gt</F>
      <p>At the highest point:</p><F>v = 0</F>
      <p>Therefore, the time required to reach the highest point is:</p><F>t<sub>up</sub> = v₀/g</F>
      <p>The maximum height above the point of projection is:</p><F>h<sub>max</sub> = v₀²/(2g)</F>
      <p>If the object returns to its initial height:</p><F>t<sub>total</sub> = 2v₀/g</F>
      <aside className="study-lesson-callout"><p><strong>Important:</strong> at the highest point,</p><F>v = 0,</F><p>but the acceleration is still</p><F>a = −g.</F><p>Zero velocity does not imply zero acceleration.</p></aside>
    </section>
    <section>
      <h3>15. Projectile Motion</h3>
      <p>Consider an object projected with initial velocity v₀ at an angle α above the horizontal. The initial velocity can be resolved into two perpendicular components:</p><F>v<sub>0x</sub> = v₀ cos α</F><F>v<sub>0y</sub> = v₀ sin α</F>
      <p>Ignoring air resistance, the horizontal acceleration is zero:</p><F>a<sub>x</sub> = 0</F>
      <p>Therefore:</p><F>x = v₀ cos α · t</F>
      <p>Vertically:</p><F>a<sub>y</sub> = −g</F><p>so</p><F>y = y₀ + v₀ sin α · t − gt²/2</F>
      <p>The velocity components are:</p><F>v<sub>x</sub> = v₀ cos α</F><F>v<sub>y</sub> = v₀ sin α − gt</F>
      <aside className="study-lesson-callout"><p><strong>Key idea:</strong> horizontal and vertical motions can be analysed independently. The horizontal component has constant velocity, while the vertical component has constant acceleration due to gravity.</p></aside>
    </section>
    <section>
      <h3>16. Time of Flight, Range and Maximum Height</h3>
      <p>If the projectile lands at the same vertical level from which it was launched, the total time of flight is:</p><F>T = 2v₀ sin α/g</F>
      <p>The horizontal range is:</p><F>R = v₀² sin 2α/g</F>
      <p>The maximum height above the launch point is:</p><F>H = v₀² sin² α/(2g)</F>
      <aside className="study-lesson-callout"><p>For equal launch and landing heights and in the absence of air resistance, the maximum horizontal range occurs at:</p><F>α = 45°</F></aside>
    </section>
    <section>
      <h3>17. Circular Motion</h3>
      <p>In circular motion, the direction of the velocity vector continuously changes. The instantaneous velocity vector is always directed <strong>tangentially to the circular path</strong>.</p>
      <Diagram name="circular-motion" caption="Velocity v is tangential to the circle; centripetal acceleration a꜀ points toward its centre O."/>
      <p>Even if the magnitude of velocity remains constant, its direction changes. Since velocity is a vector, a change in its direction means that the object has an acceleration.</p>
    </section>
    <section>
      <h3>18. Centripetal Acceleration</h3>
      <p>For uniform circular motion, acceleration is directed toward the centre of the circular path. This acceleration is called <strong>centripetal acceleration</strong>.</p><F>a<sub>c</sub> = v²/R</F>
      <p>where:</p><ul><li>a<sub>c</sub> is the centripetal acceleration;</li><li>v is the linear speed;</li><li>R is the radius of the circular path.</li></ul>
      <p>From the equation:</p><F>a<sub>c</sub> ∝ v²</F><p>and</p><F>a<sub>c</sub> ∝ 1/R.</F>
      <p>Therefore, if the speed is doubled:</p><F>a′<sub>c</sub> = (2v)²/R = 4a<sub>c</sub>.</F>
      <aside className="study-lesson-callout"><p>Centripetal acceleration changes the <strong>direction</strong> of velocity. In uniform circular motion, it does not change the magnitude of velocity.</p></aside>
    </section>
    <section>
      <h3>19. Angular Displacement and Radians</h3>
      <p>The position of an object moving around a circle can be described using its angular displacement:</p><F>φ.</F>
      <p>The SI unit of angular displacement is the <strong>radian</strong>. One complete revolution corresponds to:</p><F>360° = 2π rad</F>
      <p>Therefore:</p><F>φ<sub>rad</sub> = φ<sub>deg</sub> · π/180°</F>
      <p>For example:</p><F>90° = 90° · π/180° = π/2 rad</F>
      <p>Similarly:</p><F>180° = π rad</F><F>270° = 3π/2 rad</F><F>360° = 2π rad.</F>
      <p>The arc length s is related to angular displacement by:</p><F>s = Rφ</F><p>when φ is measured in radians.</p>
    </section>
    <section>
      <h3>20. Angular Velocity</h3>
      <p><strong>Angular velocity</strong> describes the rate of change of angular displacement with time.</p>
      <p>Average angular velocity:</p><F>ω = Δφ/Δt</F>
      <p>Instantaneous angular velocity:</p><F>ω = dφ/dt</F>
      <p>Its SI unit is:</p><F>[ω] = rad/s.</F>
      <p>During one complete revolution:</p><F>Δφ = 2π.</F>
      <p>Therefore:</p><F>ω = 2π/T</F>
      <p>Since</p><F>f = 1/T,</F><p>we also obtain:</p><F>ω = 2πf</F>
      <p>The relationship between linear speed and angular velocity is:</p><F>v = ωR</F>
    </section>
    <section>
      <h3>21. Angular Acceleration</h3>
      <p><strong>Angular acceleration</strong> describes the rate of change of angular velocity with time.</p>
      <p>Average angular acceleration is:</p><F>ε = Δω/Δt</F>
      <p>Instantaneous angular acceleration is:</p><F>ε = dω/dt</F>
      <p>Its SI unit is:</p><F>[ε] = rad/s².</F>
      <p>For constant angular acceleration:</p><F>ω = ω₀ + εt</F>
      <p>The angular equation of motion is:</p><F>φ = φ₀ + ω₀t + εt²/2</F>
      <p>Another useful equation is:</p><F>ω² = ω₀² + 2ε(φ − φ₀)</F>
    </section>
    <section>
      <h3>22. Linear and Angular Kinematics</h3>
      <p>Linear and rotational kinematics have very similar mathematical structures.</p>
      <div className="study-lesson-table" tabIndex={0} role="region" aria-label="Lesson table. Use the arrow keys to scroll."><table><thead><tr><th>Linear motion</th><th>Rotational motion</th></tr></thead><tbody>
        <tr><td>Position x</td><td>Angular position φ</td></tr><tr><td>Displacement Δx</td><td>Angular displacement Δφ</td></tr>
        <tr><td>Velocity v</td><td>Angular velocity ω</td></tr><tr><td>Acceleration a</td><td>Angular acceleration ε</td></tr>
        <tr><td>v = v₀ + at</td><td>ω = ω₀ + εt</td></tr><tr><td>Δx = v₀t + at²/2</td><td>Δφ = ω₀t + εt²/2</td></tr>
        <tr><td>v² = v₀² + 2aΔx</td><td>ω² = ω₀² + 2εΔφ</td></tr>
      </tbody></table></div>
      <p>The linear and angular quantities are also related by:</p><F>s = Rφ</F><F>v = Rω</F>
      <p>and for tangential acceleration:</p><F>a<sub>t</sub> = Rε.</F>
      <aside className="study-lesson-callout"><p><strong>Key idea:</strong> the equations of rotational kinematics have the same mathematical form as the equations of linear kinematics.</p></aside>
    </section>
    <section>
      <h3>23. Formula Summary</h3>
      <h4>Linear Kinematics</h4><F>Δx = x − x₀</F><F>v = v₀ + at</F><F>Δx = v₀t + at²/2</F><F>v² = v₀² + 2aΔx</F><F>Δx = ((v₀ + v)/2)t</F>
      <h4>Circular and Rotational Motion</h4><F>a<sub>c</sub> = v²/R</F><F>φ<sub>rad</sub> = φ<sub>deg</sub> · π/180°</F><F>s = Rφ</F><F>v = ωR</F><F>ω = ω₀ + εt</F><F>φ = φ₀ + ω₀t + εt²/2</F>
    </section>
  </>;
}
