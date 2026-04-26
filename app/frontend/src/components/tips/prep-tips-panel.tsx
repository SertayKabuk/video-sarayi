export function PrepTipsPanel() {
    return (
        <details className="group rounded-xl border border-secondary bg-primary">
            <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-4 py-2.5 text-[11px] font-medium uppercase tracking-widest text-tertiary hover:text-secondary">
                <span className="transition duration-100 group-open:rotate-90">▶</span>
                Prep tips — before you drop files here
            </summary>

            <div className="grid grid-cols-2 divide-x divide-secondary border-t border-secondary px-4 py-4">
                <div className="pr-5">
                    <h3 className="mb-2.5 text-[13px] font-semibold text-brand-secondary">
                        Insta360 X5 → Insta360 Studio
                    </h3>
                    <ol className="flex flex-col gap-1.5 pl-4 text-[12px] text-tertiary">
                        <li>
                            <strong className="text-primary">Reframe in Studio.</strong> Drag to set your
                            perspective (yaw / pitch / FOV). This is the only place you can do it — Video Sarayi
                            encodes the flat output you export.
                        </li>
                        <li>
                            <strong className="text-primary">Stabilization.</strong> Enable{" "}
                            <em className="text-warning-primary not-italic">FlowState</em> in Studio.
                        </li>
                        <li>
                            <strong className="text-primary">Color profile: keep I-Log.</strong> Choose{" "}
                            <em className="text-warning-primary not-italic">I-Log</em> in export settings. Video
                            Sarayi applies the LUT. Double-applying blows out highlights.
                        </li>
                        <li>
                            <strong className="text-primary">Export codec.</strong> ProRes 422 HQ on Mac, or
                            Studio "High" H.264/H.265 at max bitrate on Windows.
                        </li>
                        <li>
                            <strong className="text-primary">Resolution.</strong> Export at native stitched
                            resolution (5.7K or 4K).
                        </li>
                    </ol>
                </div>

                <div className="pl-5">
                    <h3 className="mb-2.5 text-[13px] font-semibold text-brand-secondary">
                        DJI Osmo Action 6 → DaVinci Resolve
                    </h3>
                    <ol className="flex flex-col gap-1.5 pl-4 text-[12px] text-tertiary">
                        <li>
                            <strong className="text-primary">Do your edit here.</strong> Cuts, sync to music,
                            trimming — everything creative goes in Resolve.
                        </li>
                        <li>
                            <strong className="text-primary">Color profile: keep D-LogM.</strong> Do{" "}
                            <em className="text-warning-primary not-italic">not</em> apply the LUT in Resolve.
                            Video Sarayi applies it during encoding.
                        </li>
                        <li>
                            <strong className="text-primary">No color grading yet.</strong> Leave the timeline
                            in log.
                        </li>
                        <li>
                            <strong className="text-primary">Export codec:</strong>
                            <ul className="mt-1.5 flex flex-col gap-1 pl-4">
                                <li>
                                    <em className="not-italic text-secondary">Not using Gyroflow:</em> DNxHR HQ
                                    or ProRes 422 HQ.
                                </li>
                                <li>
                                    <em className="not-italic text-secondary">Using Gyroflow:</em> H.265 at max
                                    bitrate (200 Mbps+).
                                </li>
                            </ul>
                        </li>
                        <li>
                            <strong className="text-primary">Resolution.</strong> Export at native 4K. Keep the
                            original frame rate.
                        </li>
                    </ol>
                </div>
            </div>
        </details>
    );
}
