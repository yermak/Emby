﻿using System;
using MediaBrowser.Controller;
using MediaBrowser.Model.Progress;

namespace MediaBrowser.Program
{
    class Program
    {
        static void Main(string[] args)
        {
            LoadKernel();
        }

        private static void LoadKernel()
        {
            DateTime now = DateTime.Now;

            Console.WriteLine("Loading");

            Kernel kernel = new Kernel();

            Progress<TaskProgress> progress = new Progress<TaskProgress>();

            kernel.Init(progress);

            var time = DateTime.Now - now;
            Console.WriteLine("Done in " + time.TotalSeconds + " seconds");
            
            Console.WriteLine("Press Enter to quit.");
            Console.ReadLine();

            kernel.Dispose();
        }
    }
}
